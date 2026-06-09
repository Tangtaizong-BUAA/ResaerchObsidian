import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var settings: AppSettings
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Mac 连接") {
                    Label("自动发现附近的 Formula Bridge", systemImage: "dot.radiowaves.left.and.right")
                    Text("不需要填写 IP 或端口。Mac 和 iPad 靠近并允许本地网络访问后，画板会自动显示可连接的 Mac。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section("画板") {
                    Toggle("只响应 Apple Pencil", isOn: $settings.pencilOnly)
                }

                Section("使用说明") {
                    Text("1. Obsidian 插件启动 formula-peer-bridge")
                    Text("2. iPad 自动发现附近打开桥接的小助手")
                    Text("3. 画板图片发送到 Mac，本地 Pix2Text 识别")
                    Text("4. 在画板上书写公式，点“发送识别”")
                    Text("5. 公式自动出现在 Obsidian 光标处")
                }
            }
            .navigationTitle("设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }
                }
            }
        }
    }
}
