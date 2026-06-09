import Combine
import Foundation
import MultipeerConnectivity
import UIKit

struct DiscoveredBridge: Identifiable, Equatable {
    let id: String
    let name: String
}

@MainActor
class BridgeConnection: NSObject, ObservableObject {
    @Published var isConnected = false
    @Published var statusText = "未连接"
    @Published var discoveredBridges: [DiscoveredBridge] = []
    @Published var lastRecognizedLatex = ""
    @Published var lastRecognitionError = ""

    private let serviceType = "formula-bridge"
    private let peerID = MCPeerID(displayName: UIDevice.current.name)
    private let session: MCSession
    private let browser: MCNearbyServiceBrowser
    private var peers: [String: MCPeerID] = [:]
    private var targetPeer: MCPeerID?

    init(settings: AppSettings) {
        self.session = MCSession(peer: peerID, securityIdentity: nil, encryptionPreference: .required)
        self.browser = MCNearbyServiceBrowser(peer: peerID, serviceType: serviceType)
        super.init()
        session.delegate = self
        browser.delegate = self
    }

    func startDiscovery() {
        browser.stopBrowsingForPeers()
        discoveredBridges = []
        peers = [:]
        targetPeer = nil
        isConnected = false
        statusText = "正在搜索 Mac..."
        browser.startBrowsingForPeers()
    }

    func connect() {
        if let first = discoveredBridges.first {
            connect(to: first)
        } else {
            startDiscovery()
        }
    }

    func connect(to bridge: DiscoveredBridge) {
        guard let peer = peers[bridge.id] else {
            statusText = "Mac 不在线"
            return
        }

        targetPeer = peer
        statusText = "正在连接 Mac..."
        browser.invitePeer(peer, to: session, withContext: nil, timeout: 20)
    }

    func disconnect() {
        session.disconnect()
        browser.stopBrowsingForPeers()
        isConnected = false
        statusText = "未连接"
    }

    @discardableResult
    func sendFormulaImage(_ imageData: Data) -> Bool {
        guard isConnected, !session.connectedPeers.isEmpty else {
            statusText = "未连接，无法发送"
            return false
        }

        let msg = [
            "type": "recognize_formula_image",
            "format": "jpeg",
            "image_base64": imageData.base64EncodedString()
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: msg) else {
            statusText = "图片打包失败"
            return false
        }

        do {
            try session.send(data, toPeers: session.connectedPeers, with: .reliable)
            statusText = "已发送到 Mac，正在本地识别..."
            return true
        } catch {
            statusText = "发送失败：\(error.localizedDescription)"
            return false
        }
    }
}

extension BridgeConnection: MCNearbyServiceBrowserDelegate {
    nonisolated func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        Task { @MainActor in
            let bridge = DiscoveredBridge(id: peerID.displayName, name: peerID.displayName)
            peers[bridge.id] = peerID
            if !discoveredBridges.contains(bridge) {
                discoveredBridges.append(bridge)
            }

            if !isConnected {
                statusText = "找到 Mac，正在连接..."
                connect(to: bridge)
            }
        }
    }

    nonisolated func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        Task { @MainActor in
            peers.removeValue(forKey: peerID.displayName)
            discoveredBridges.removeAll { $0.id == peerID.displayName }
        }
    }

    nonisolated func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {
        Task { @MainActor in
            statusText = "搜索失败：\(error.localizedDescription)"
        }
    }
}

extension BridgeConnection: MCSessionDelegate {
    nonisolated func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        Task { @MainActor in
            switch state {
            case .connected:
                isConnected = true
                statusText = "已连接 Mac"
            case .connecting:
                statusText = "正在连接 Mac..."
            case .notConnected:
                isConnected = false
                statusText = "连接断开"
            @unknown default:
                isConnected = false
                statusText = "连接状态未知"
            }
        }
    }

    nonisolated func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else { return }

        Task { @MainActor in
            switch type {
            case "recognized_formula":
                let latex = (json["latex"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                if !latex.isEmpty {
                    lastRecognizedLatex = latex
                    statusText = "Mac 本地识别完成"
                }
            case "recognition_error":
                let message = json["message"] as? String ?? "Mac 本地识别失败"
                lastRecognitionError = message
                statusText = message
            default:
                break
            }
        }
    }

    nonisolated func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {}

    nonisolated func session(
        _ session: MCSession,
        didStartReceivingResourceWithName resourceName: String,
        fromPeer peerID: MCPeerID,
        with progress: Progress
    ) {}

    nonisolated func session(
        _ session: MCSession,
        didFinishReceivingResourceWithName resourceName: String,
        fromPeer peerID: MCPeerID,
        at localURL: URL?,
        withError error: Error?
    ) {}
}
