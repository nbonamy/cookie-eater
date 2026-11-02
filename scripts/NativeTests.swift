import Foundation
import Darwin

@main struct NativeTests {
    static func main() async {
        setbuf(stdout, nil)
        let status = await ModelBridge.handle(["type": "status"])
        assert(status["bridge"] as? String == "ok")
        print("PASS native availability: \(status["model"] ?? "unknown")")
        if status["model"] as? String == "available" {
            for input: [String: Any] in [
                ["type": "interpret"],
                ["type": "interpret", "banner": String(repeating: "a", count: 2001), "candidates": [["id": "c0", "label": "Reject all"]]],
                ["type": "interpret", "banner": "Cookies", "candidates": []]
            ] {
                let result = await ModelBridge.handle(input)
                assert(result["action"] as? String == "none")
                assert(result["error"] as? String == "invalidInput")
            }
            print("PASS native invalid input bounds")
            for label in ["Decline optional cookies", "Use essential cookies only", "CONFIRMER VOTRE REFUS"] {
                let result = await ModelBridge.handle(["type": "interpret", "banner": "Your cookie choices\n\nWe use cookies to measure visits and personalize ads.\n\nAccept all\n\(label)", "candidates": [["id": "c0", "label": "Accept all", "state": "button"], ["id": "c1", "label": label, "state": "button"]]])
                print(String(data: try! JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]), encoding: .utf8)!)
                assert(result["action"] as? String == "reject" && result["candidateID"] as? String == "c1")
            }
            print("PASS real on-device classification, English and French refusal confirmation")
            let cases: [(String, String, [String], String, String)] = [
                ("TF1 French confirmation", "Validation de vos choix & conditions d’accès à nos contenus. Vous avez fait le choix de refuser les cookies. Pour accéder gratuitement à l’ensemble des vidéos et au direct, vous devez accepter les cookies et avoir un compte. Confirmer votre refus confirme le refus de tous les cookies et donne accès gratuitement aux extraits. Vous pouvez aussi vous abonner à Premium.", ["En savoir plus", "CONFIRMER VOTRE REFUS", "MODIFIER ET TOUT ACCEPTER", "PARAMÉTRER VOS CHOIX", "S’ABONNER À PREMIUM"], "reject", "c1"),
                ("German", "Wir verwenden Cookies für personalisierte Werbung. Wählen Sie Ihre Datenschutzeinstellungen.", ["Alle akzeptieren", "Nur erforderliche zulassen"], "reject", "c1"),
                ("Italian", "Utilizziamo cookie per pubblicità personalizzata. Scegli le tue preferenze.", ["Accetta tutti", "Continua senza accettare"], "reject", "c1"),
                ("German subscription trap", "Cookies akzeptieren oder ein kostenpflichtiges Abonnement abschließen.", ["Ablehnen und kostenpflichtig abonnieren", "Alle akzeptieren und fortfahren"], "accept", "c1"),
                ("Italian payment only", "Per rifiutare i cookie è necessario pagare un abbonamento.", ["Rifiuta e abbonati a pagamento"], "none", "none")
            ]
            for (name, banner, labels, action, id) in cases {
                let result = await ModelBridge.handle(["type":"interpret", "banner":banner, "candidates":labels.enumerated().map { ["id":"c\($0.offset)", "label":$0.element, "state":"button"] }])
                print("\(name): \(result)")
                if name == "German subscription trap" {
                    assert((result["action"] as? String == "none") || (result["action"] as? String == "accept" && result["candidateID"] as? String == "c1"), name)
                } else {
                    assert(result["action"] as? String == action && result["candidateID"] as? String == id, name)
                }
            }
            print("PASS real French, German, Italian and payment safeguards")
        }
    }
}
