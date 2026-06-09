import Combine
import PencilKit
import SwiftUI
import UIKit

@MainActor
class DrawingViewModel: ObservableObject {
    @Published var drawing = PKDrawing()
    @Published var recognizedLatex = ""
    @Published var isRecognizing = false
    @Published var errorMessage = ""
    @Published var lastInserted = false

    init(settings: AppSettings) {
    }

    func makeRecognitionJPEG() -> Data? {
        guard !drawing.strokes.isEmpty else {
            errorMessage = "请先在画板上写公式"
            return nil
        }

        isRecognizing = true
        errorMessage = ""

        let bounds = drawing.bounds.insetBy(dx: -20, dy: -20)
        let image = makeRecognitionImage(from: drawing, bounds: bounds)

        guard let jpeg = image.jpegData(compressionQuality: 0.92) else {
            errorMessage = "图片转换失败"
            isRecognizing = false
            return nil
        }

        return jpeg
    }

    func finishSending() {
        isRecognizing = false
    }

    func applyRecognizedLatex(_ latex: String) {
        recognizedLatex = latex
        errorMessage = ""
        isRecognizing = false
    }

    func applyRecognitionError(_ message: String) {
        errorMessage = message
        isRecognizing = false
    }

    func clearCanvas() {
        drawing = PKDrawing()
        recognizedLatex = ""
        errorMessage = ""
        lastInserted = false
    }

    private func makeRecognitionImage(from drawing: PKDrawing, bounds: CGRect) -> UIImage {
        let scale: CGFloat = 4.0
        let size = CGSize(width: max(bounds.width * scale, 1), height: max(bounds.height * scale, 1))
        let rendered = drawing.image(from: bounds, scale: scale)

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true

        let image = UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            rendered.draw(in: CGRect(origin: .zero, size: size))
        }

        return image
    }
}
