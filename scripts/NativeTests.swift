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
                ["type": "interpret", "banner": "Cookies", "candidates": []],
                ["type":"interpret","banner":"Cookies","dom":String(repeating:"x",count:3001),"candidates":[["id":"c0","label":"Reject all"]]]
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
            let m6 = await ModelBridge.handle(["type":"interpret", "canSave":true, "banner":"Préférences de confidentialité : les radios Refuser sont sélectionnées pour toutes les finalités. Enregistrer est activé.", "dom":"<div role=\"dialog\"><h2>Vos choix de confidentialité</h2><button data-ce-id=\"c3\" aria-label=\"fermer et revenir à la vue de gestion de consentement\">×</button><div role=\"radiogroup\"><button role=\"radio\" aria-checked=\"true\">Refuser</button><button role=\"radio\" aria-checked=\"false\">Accepter</button></div><button data-ce-id=\"c0\">Refuser et payer 5,99€/mois</button><button data-ce-id=\"c1\">Tout accepter</button><button data-ce-id=\"c2\">Enregistrer vos préférences et fermer</button></div>", "candidates":[
                ["id":"c0", "label":"Refuser et payer 5,99€/mois", "state":"button"],
                ["id":"c1", "label":"Tout accepter", "state":"button"],
                ["id":"c2", "label":"Enregistrer vos préférences et fermer", "state":"button"],
                ["id":"c3", "label":"fermer et revenir à la vue de gestion de consentement", "text":"×", "state":"button"]
            ]])
            print("M6 selected refusal DOM: \(m6)")
            assert(m6["action"] as? String == "save" && m6["candidateID"] as? String == "c2")
            let confirmation = await ModelBridge.handle(["type":"interpret","banner":"Vous avez refusé les cookies. Confirmez votre refus.","dom":"<div role=\"dialog\"><p>Vous avez refusé les cookies.</p><button data-ce-id=\"c0\">Confirmer votre refus</button><button data-ce-id=\"c1\">Modifier et tout accepter</button></div>","canSave":false,"candidates":[["id":"c0","label":"Confirmer votre refus","state":"button"],["id":"c1","label":"Modifier et tout accepter","state":"button"]]])
            assert(confirmation["action"] as? String == "reject" && confirmation["candidateID"] as? String == "c0")
            print("PASS standalone DOM confirmation is rejection, not a settings save")
            print("PASS real French, German, Italian and payment safeguards")
        }
    }
}
