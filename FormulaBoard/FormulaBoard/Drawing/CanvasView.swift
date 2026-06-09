import PencilKit
import SwiftUI

private enum FormulaCanvasStyle {
    static let background = UIColor(red: 0.98, green: 0.98, blue: 0.96, alpha: 1)
    static let ink = UIColor.black
    static let lineWidth: CGFloat = 3
}

enum DrawingTool {
    case pen
    case eraser
}

struct CanvasView: UIViewRepresentable {
    @Binding var drawing: PKDrawing
    let tool: DrawingTool
    let pencilOnly: Bool
    var onDrawingChanged: () -> Void

    func makeUIView(context: Context) -> FormulaCanvasView {
        let canvas = FormulaCanvasView()
        canvas.drawing = drawing
        canvas.selectedDrawingTool = tool
        canvas.pencilOnly = pencilOnly
        canvas.applyFormulaTool()
        canvas.backgroundColor = FormulaCanvasStyle.background
        canvas.opaqueBackgroundColor = FormulaCanvasStyle.background
        canvas.overrideUserInterfaceStyle = .light
        canvas.drawingPolicy = pencilOnly ? .pencilOnly : .anyInput
        canvas.delegate = context.coordinator
        canvas.alwaysBounceVertical = false
        canvas.isRulerActive = false
        return canvas
    }

    func updateUIView(_ uiView: FormulaCanvasView, context: Context) {
        if uiView.drawing != drawing {
            uiView.drawing = drawing
        }

        uiView.selectedDrawingTool = tool
        uiView.pencilOnly = pencilOnly
        uiView.opaqueBackgroundColor = FormulaCanvasStyle.background
        uiView.applyFormulaTool()
        uiView.backgroundColor = FormulaCanvasStyle.background
        uiView.layer.backgroundColor = FormulaCanvasStyle.background.cgColor
    }

    fileprivate func makeTool() -> PKTool {
        switch tool {
        case .pen:
            return PKInkingTool(.monoline, color: FormulaCanvasStyle.ink, width: FormulaCanvasStyle.lineWidth)
        case .eraser:
            return PKEraserTool(.vector)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, PKCanvasViewDelegate {
        var parent: CanvasView
        private var isNormalizingDrawing = false

        init(_ parent: CanvasView) {
            self.parent = parent
        }

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            guard !isNormalizingDrawing else { return }

            let normalized = canvasView.drawing.normalizedForFormulaCanvas()
            if normalized != canvasView.drawing {
                isNormalizingDrawing = true
                canvasView.drawing = normalized
                isNormalizingDrawing = false
            }

            parent.drawing = normalized
            parent.onDrawingChanged()
        }
    }
}

final class FormulaCanvasView: PKCanvasView {
    var selectedDrawingTool: DrawingTool = .pen
    var pencilOnly = false
    var opaqueBackgroundColor = FormulaCanvasStyle.background

    func applyFormulaTool() {
        backgroundColor = opaqueBackgroundColor
        layer.backgroundColor = opaqueBackgroundColor.cgColor
        isOpaque = true
        overrideUserInterfaceStyle = .light
        drawingPolicy = pencilOnly ? .pencilOnly : .anyInput

        switch selectedDrawingTool {
        case .pen:
            tool = PKInkingTool(.monoline, color: FormulaCanvasStyle.ink, width: FormulaCanvasStyle.lineWidth)
        case .eraser:
            tool = PKEraserTool(.vector)
        }
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        applyFormulaTool()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        applyFormulaTool()
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        applyFormulaTool()
        super.touchesBegan(touches, with: event)
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        applyFormulaTool()
        super.touchesMoved(touches, with: event)
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        applyFormulaTool()
        super.touchesEnded(touches, with: event)
    }
}

private extension PKDrawing {
    func normalizedForFormulaCanvas() -> PKDrawing {
        let normalizedStrokes = strokes.map { stroke -> PKStroke in
            var normalizedStroke = stroke
            normalizedStroke.ink = PKInk(.monoline, color: FormulaCanvasStyle.ink)
            normalizedStroke.path = PKStrokePath(
                controlPoints: stroke.path.map { point in
                    PKStrokePoint(
                        location: point.location,
                        timeOffset: point.timeOffset,
                        size: CGSize(width: FormulaCanvasStyle.lineWidth, height: FormulaCanvasStyle.lineWidth),
                        opacity: max(point.opacity, 1),
                        force: point.force,
                        azimuth: point.azimuth,
                        altitude: point.altitude,
                        secondaryScale: point.secondaryScale,
                        threshold: point.threshold
                    )
                },
                creationDate: stroke.path.creationDate
            )
            return normalizedStroke
        }

        return PKDrawing(strokes: normalizedStrokes)
    }
}
