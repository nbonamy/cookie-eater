import Foundation

@main struct ModelProbe {
    static func main() async {
        let result = await ModelBridge.handle(["type": "status"])
        print(String(data: try! JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]), encoding: .utf8)!)
        if CommandLine.arguments.contains("--infer") {
            let decision = await ModelBridge.handle(["type": "interpret", "banner": "We use cookies. Choose your privacy preferences.", "candidates": [["id": "c0", "label": "Allow all cookies"], ["id": "c1", "label": "Decline optional cookies"]]])
            print(String(data: try! JSONSerialization.data(withJSONObject: decision, options: [.sortedKeys]), encoding: .utf8)!)
        }
    }
}
