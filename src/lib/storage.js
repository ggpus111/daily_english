// 시크릿 모드나 저장 공간 초과에서는 storage 접근이 예외를 던진다.
// 앱이 멈추지 않도록 모든 접근을 이곳으로 모은다.
function createStorage(getArea) {
  return {
    get(key) {
      try {
        return getArea().getItem(key)
      } catch {
        return null
      }
    },
    set(key, value) {
      try {
        getArea().setItem(key, value)
        return true
      } catch {
        return false
      }
    },
    remove(key) {
      try {
        getArea().removeItem(key)
      } catch {
        // 지울 수 없으면 할 수 있는 일이 없다.
      }
    },
    getJson(key) {
      try {
        return JSON.parse(getArea().getItem(key))
      } catch {
        return null
      }
    },
  }
}

export const local = createStorage(() => window.localStorage)
export const session = createStorage(() => window.sessionStorage)
