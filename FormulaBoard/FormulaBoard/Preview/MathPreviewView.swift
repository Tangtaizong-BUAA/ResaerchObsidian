import SwiftUI
import WebKit

struct MathPreviewView: UIViewRepresentable {
    let latex: String

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.backgroundColor = UIColor(white: 0.12, alpha: 1)
        webView.isOpaque = false
        webView.scrollView.isScrollEnabled = false
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        webView.loadHTMLString(generateHTML(latex), baseURL: nil)
    }

    private func generateHTML(_ latex: String) -> String {
        let escaped = latex
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "`", with: "\\`")

        return """
        <!DOCTYPE html>
        <html>
        <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            background: #1e1e1e;
            color: white;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 80px;
            margin: 0;
            padding: 12px;
          }
        </style>
        <script>
        MathJax = {
          tex: { inlineMath: [['$','$']] },
          startup: { typeset: false }
        };
        </script>
        <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
        </head>
        <body>
        <div id="formula">$$\(escaped)$$</div>
        <script>
        document.addEventListener('DOMContentLoaded', () => {
          MathJax.typesetPromise()
        })
        </script>
        </body>
        </html>
        """
    }
}
