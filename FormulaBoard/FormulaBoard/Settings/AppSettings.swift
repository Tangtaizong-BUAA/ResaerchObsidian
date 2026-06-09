import Combine
import Foundation

class AppSettings: ObservableObject {
    @Published var pencilOnly: Bool {
        didSet { UserDefaults.standard.set(pencilOnly, forKey: "pencilOnly") }
    }

    init() {
        self.pencilOnly = UserDefaults.standard.object(forKey: "pencilOnly") as? Bool ?? false
    }
}
