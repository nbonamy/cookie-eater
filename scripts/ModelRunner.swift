import Foundation

// Test-only stdin bridge: uses exactly the same on-device model implementation as Safari.
@main struct ModelRunner {
    static func main() async {
        do {
            let input = FileHandle.standardInput.readDataToEndOfFile()
            guard let message = try JSONSerialization.jsonObject(with: input) as? [String: Any] else { return }
            let result = await ModelBridge.handle(message)
            let output = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
            FileHandle.standardOutput.write(output)
        } catch {
            print("{\"action\":\"none\",\"error\":\"invalidTestInput\"}")
        }
    }
}
