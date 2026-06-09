import Foundation
import MultipeerConnectivity

private let serviceType = "formula-bridge"

final class FormulaPeerBridge: NSObject, MCNearbyServiceAdvertiserDelegate, MCSessionDelegate {
    private let peerID: MCPeerID
    private let session: MCSession
    private let advertiser: MCNearbyServiceAdvertiser
    private let helperDirectory: URL

    override init() {
        let host = Host.current().localizedName ?? "Mac"
        self.peerID = MCPeerID(displayName: "Formula Bridge on \(host)")
        self.session = MCSession(peer: peerID, securityIdentity: nil, encryptionPreference: .required)
        self.advertiser = MCNearbyServiceAdvertiser(
            peer: peerID,
            discoveryInfo: ["app": "FormulaBoard"],
            serviceType: serviceType
        )
        self.helperDirectory = URL(fileURLWithPath: CommandLine.arguments[0]).deletingLastPathComponent()

        super.init()
        session.delegate = self
        advertiser.delegate = self
    }

    func start() {
        advertiser.startAdvertisingPeer()
        fputs("[peer-bridge] Advertising \(serviceType) as \(peerID.displayName)\n", stderr)
        fflush(stderr)
        RunLoop.main.run()
    }

    func advertiser(
        _ advertiser: MCNearbyServiceAdvertiser,
        didReceiveInvitationFromPeer peerID: MCPeerID,
        withContext context: Data?,
        invitationHandler: @escaping (Bool, MCSession?) -> Void
    ) {
        fputs("[peer-bridge] Accepted invitation from \(peerID.displayName)\n", stderr)
        fflush(stderr)
        invitationHandler(true, session)
    }

    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {
        fputs("[peer-bridge] Failed to advertise: \(error.localizedDescription)\n", stderr)
        fflush(stderr)
    }

    func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        let label: String
        switch state {
        case .notConnected: label = "notConnected"
        case .connecting: label = "connecting"
        case .connected: label = "connected"
        @unknown default: label = "unknown"
        }
        fputs("[peer-bridge] \(peerID.displayName): \(label)\n", stderr)
        fflush(stderr)
    }

    func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        do {
            guard
                let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                let type = json["type"] as? String
            else {
                return
            }

            if type == "recognize_formula_image" {
                guard
                    let base64 = json["image_base64"] as? String,
                    let imageData = Data(base64Encoded: base64)
                else {
                    sendError("图片数据无效", to: peerID)
                    return
                }

                recognizeImage(imageData, from: peerID)
                return
            }

            if type == "insert_formula",
               let latex = json["latex"] as? String,
               !latex.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                emitFormula(latex, from: peerID)
            }
        } catch {
            fputs("[peer-bridge] Invalid message: \(error.localizedDescription)\n", stderr)
            fflush(stderr)
        }
    }

    private func recognizeImage(_ imageData: Data, from peerID: MCPeerID) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let imageURL = FileManager.default.temporaryDirectory
                    .appendingPathComponent("formulaboard-\(UUID().uuidString).jpg")
                try imageData.write(to: imageURL, options: .atomic)
                defer { try? FileManager.default.removeItem(at: imageURL) }

                fputs("[peer-bridge] Received image from \(peerID.displayName), running Pix2Text...\n", stderr)
                fflush(stderr)

                let latex = try self.runPix2Text(imageURL: imageURL)
                self.emitFormula(latex, from: peerID)
                self.sendJSON(["type": "recognized_formula", "latex": latex], to: peerID)
            } catch {
                let message = "Pix2Text 识别失败：\(error.localizedDescription)"
                fputs("[peer-bridge] \(message)\n", stderr)
                fflush(stderr)
                self.sendError(message, to: peerID)
            }
        }
    }

    private func runPix2Text(imageURL: URL) throws -> String {
        let scriptURL = helperDirectory.appendingPathComponent("pix2text_formula_ocr.py")
        guard FileManager.default.fileExists(atPath: scriptURL.path) else {
            throw BridgeError.scriptMissing(scriptURL.path)
        }

        let process = Process()
        process.executableURL = pythonExecutableURL()
        process.arguments = [scriptURL.path, imageURL.path]
        process.currentDirectoryURL = helperDirectory
        let cacheDirectory = helperDirectory.appendingPathComponent("model-cache", isDirectory: true)
        try? FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
        process.environment = ProcessInfo.processInfo.environment.merging([
            "PYTHONUNBUFFERED": "1",
            "MPLCONFIGDIR": cacheDirectory.appendingPathComponent("matplotlib", isDirectory: true).path,
            "YOLO_CONFIG_DIR": cacheDirectory.appendingPathComponent("ultralytics", isDirectory: true).path,
            "HF_HOME": cacheDirectory.appendingPathComponent("huggingface", isDirectory: true).path,
            "PIX2TEXT_HOME": cacheDirectory.appendingPathComponent("pix2text", isDirectory: true).path,
            "CNOCR_HOME": cacheDirectory.appendingPathComponent("cnocr", isDirectory: true).path,
            "CNSTD_HOME": cacheDirectory.appendingPathComponent("cnstd", isDirectory: true).path,
        ]) { _, new in new }

        let stdout = Pipe()
        let stderr = Pipe()
        process.standardOutput = stdout
        process.standardError = stderr

        try process.run()
        process.waitUntilExit()

        let output = String(data: stdout.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let errorOutput = String(data: stderr.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        guard process.terminationStatus == 0 else {
            throw BridgeError.ocrFailed(errorOutput.isEmpty ? "python exited \(process.terminationStatus)" : errorOutput)
        }

        guard !output.isEmpty else {
            throw BridgeError.emptyOCRResult(errorOutput)
        }

        return output
    }

    private func pythonExecutableURL() -> URL {
        if let configured = ProcessInfo.processInfo.environment["PIX2TEXT_PYTHON"], !configured.isEmpty {
            return URL(fileURLWithPath: configured)
        }

        for path in ["/opt/anaconda3/bin/python3", "/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"] {
            if FileManager.default.fileExists(atPath: path) {
                return URL(fileURLWithPath: path)
            }
        }

        return URL(fileURLWithPath: "/usr/bin/python3")
    }

    private func emitFormula(_ latex: String, from peerID: MCPeerID) {
        print("FORMULA:\(latex)")
        fflush(stdout)
        fputs("[peer-bridge] Formula from \(peerID.displayName): \(latex)\n", stderr)
        fflush(stderr)
    }

    private func sendError(_ message: String, to peerID: MCPeerID) {
        sendJSON(["type": "recognition_error", "message": message], to: peerID)
    }

    private func sendJSON(_ object: [String: String], to peerID: MCPeerID) {
        guard let data = try? JSONSerialization.data(withJSONObject: object) else { return }
        do {
            try session.send(data, toPeers: [peerID], with: .reliable)
        } catch {
            fputs("[peer-bridge] Failed to send response: \(error.localizedDescription)\n", stderr)
            fflush(stderr)
        }
    }

    func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {}

    func session(
        _ session: MCSession,
        didStartReceivingResourceWithName resourceName: String,
        fromPeer peerID: MCPeerID,
        with progress: Progress
    ) {}

    func session(
        _ session: MCSession,
        didFinishReceivingResourceWithName resourceName: String,
        fromPeer peerID: MCPeerID,
        at localURL: URL?,
        withError error: Error?
    ) {}
}

private enum BridgeError: LocalizedError {
    case scriptMissing(String)
    case ocrFailed(String)
    case emptyOCRResult(String)

    var errorDescription: String? {
        switch self {
        case .scriptMissing(let path):
            return "找不到本地识别脚本：\(path)"
        case .ocrFailed(let message):
            return message
        case .emptyOCRResult(let message):
            return message.isEmpty ? "Pix2Text 返回空结果" : "Pix2Text 返回空结果：\(message)"
        }
    }
}

FormulaPeerBridge().start()
