import PencilKit
import SwiftUI

struct ContentView: View {
    @EnvironmentObject var settings: AppSettings
    @StateObject private var vm: DrawingViewModel
    @StateObject private var bridge: BridgeConnection
    @State private var showSettings = false
    @State private var drawingTool: DrawingTool = .pen

    init(settings: AppSettings) {
        _vm = StateObject(wrappedValue: DrawingViewModel(settings: settings))
        _bridge = StateObject(wrappedValue: BridgeConnection(settings: settings))
    }

    var body: some View {
        HStack(spacing: 0) {
            ZStack(alignment: .topTrailing) {
                CanvasView(drawing: $vm.drawing, tool: drawingTool, pencilOnly: settings.pencilOnly) {}
                    .ignoresSafeArea()

                HStack(spacing: 10) {
                    Button(action: { drawingTool = .pen }) {
                        Image(systemName: "pencil.tip")
                            .font(.title2)
                            .foregroundColor(.white)
                            .frame(width: 46, height: 46)
                            .background(drawingTool == .pen ? Color.blue : Color.white.opacity(0.15))
                            .clipShape(Circle())
                    }

                    Button(action: { drawingTool = .eraser }) {
                        Image(systemName: "eraser")
                            .font(.title2)
                            .foregroundColor(.white)
                            .frame(width: 46, height: 46)
                            .background(drawingTool == .eraser ? Color.blue : Color.white.opacity(0.15))
                            .clipShape(Circle())
                    }

                    Button(action: { vm.clearCanvas() }) {
                        Image(systemName: "trash")
                            .font(.title2)
                            .foregroundColor(.white)
                            .frame(width: 46, height: 46)
                            .background(Color.white.opacity(0.15))
                            .clipShape(Circle())
                    }
                }
                .padding(20)
            }
            .frame(maxWidth: .infinity)

            VStack(spacing: 16) {
                HStack(spacing: 8) {
                    Circle()
                        .fill(bridge.isConnected ? Color.green : Color.red)
                        .frame(width: 10, height: 10)
                    Text(bridge.statusText)
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gear")
                            .foregroundColor(.secondary)
                    }
                }
                .padding(.horizontal)
                .padding(.top, 20)

                Divider()

                Toggle(isOn: $settings.pencilOnly) {
                    Label("只用 Apple Pencil", systemImage: "applepencil")
                        .font(.caption)
                }
                .padding(.horizontal)

                if !bridge.isConnected {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("发现的 Mac")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)

                        Button {
                            bridge.connect()
                        } label: {
                            HStack {
                                Image(systemName: "dot.radiowaves.left.and.right")
                                Text("搜索并连接 Mac")
                                    .lineLimit(1)
                                Spacer()
                                Image(systemName: "arrow.right.circle")
                            }
                            .font(.caption)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .padding(.horizontal, 12)
                            .background(Color.blue.opacity(0.22))
                            .foregroundColor(.primary)
                            .cornerRadius(8)
                        }
                        .padding(.horizontal)

                        if bridge.discoveredBridges.isEmpty {
                            Text("正在搜索附近已打开的 Formula Bridge...")
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .padding(.horizontal)
                        } else {
                            ForEach(bridge.discoveredBridges) { server in
                                Button {
                                    bridge.connect(to: server)
                                } label: {
                                    HStack {
                                        Image(systemName: "macbook")
                                        Text(server.name)
                                            .lineLimit(1)
                                        Spacer()
                                        Image(systemName: "link")
                                    }
                                    .font(.caption)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 10)
                                    .padding(.horizontal, 12)
                                    .background(Color.white.opacity(0.08))
                                    .foregroundColor(.primary)
                                    .cornerRadius(8)
                                }
                                .padding(.horizontal)
                            }
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("LaTeX")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.horizontal)

                    ScrollView {
                        Text(vm.recognizedLatex.isEmpty ? "识别结果将显示在这里" : vm.recognizedLatex)
                            .font(.system(.body, design: .monospaced))
                            .foregroundColor(vm.recognizedLatex.isEmpty ? .secondary : .primary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(10)
                    }
                    .frame(height: 100)
                    .background(Color.white.opacity(0.05))
                    .cornerRadius(8)
                    .padding(.horizontal)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("预览")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.horizontal)

                    MathPreviewView(latex: vm.recognizedLatex.isEmpty ? "f(x)" : vm.recognizedLatex)
                        .frame(height: 80)
                        .cornerRadius(8)
                        .padding(.horizontal)
                }

                if !vm.errorMessage.isEmpty {
                    Text(vm.errorMessage)
                        .font(.caption)
                        .foregroundColor(.red)
                        .padding(.horizontal)
                }

                Spacer()

                VStack(spacing: 12) {
                    Button(action: {
                        guard let imageData = vm.makeRecognitionJPEG() else { return }
                        if !bridge.sendFormulaImage(imageData) {
                            vm.finishSending()
                        }
                    }) {
                        HStack {
                            if vm.isRecognizing {
                                ProgressView()
                                    .scaleEffect(0.8)
                                    .tint(.white)
                            }
                            Text(vm.isRecognizing ? "Mac 识别中..." : "发送识别")
                                .fontWeight(.medium)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                    }
                    .disabled(vm.isRecognizing || !bridge.isConnected)

                    Button(action: {
                        guard !vm.recognizedLatex.isEmpty else { return }
                        vm.lastInserted = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                            vm.clearCanvas()
                        }
                    }) {
                        Text("清空继续")
                            .fontWeight(.medium)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(vm.recognizedLatex.isEmpty ? Color.gray : Color.green)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                    }
                    .disabled(vm.recognizedLatex.isEmpty || !bridge.isConnected)
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
            .frame(width: 280)
            .background(Color(UIColor.systemBackground).opacity(0.95))
        }
        .background(Color(white: 0.08))
        .preferredColorScheme(.dark)
        .onAppear {
            bridge.startDiscovery()
        }
        .onDisappear {
            bridge.disconnect()
        }
        .onChange(of: bridge.lastRecognizedLatex) { _, latex in
            guard !latex.isEmpty else { return }
            vm.applyRecognizedLatex(latex)
        }
        .onChange(of: bridge.lastRecognitionError) { _, message in
            guard !message.isEmpty else { return }
            vm.applyRecognitionError(message)
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
                .environmentObject(settings)
        }
    }
}
