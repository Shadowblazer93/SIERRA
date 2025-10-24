let curAvailId = 0
let undoResetCache = 0

export const getNodeId = (rep) => {
  if (rep) {
    rep = rep.toUpperCase()
    const res = rep.charCodeAt(0) - 65
    curAvailId = Math.max(curAvailId, res + 1)
    return `${res}`

  } else {
    const res = `${curAvailId}`
    curAvailId++
    return res
  }
}

export const resetCurAvailId = () => {
  undoResetCache = curAvailId;
  curAvailId = 0
}

export const undoResetNodeId = () => {
  curAvailId = undoResetCache
  undoResetCache = 0
}
