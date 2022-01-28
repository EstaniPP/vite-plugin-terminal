interface TimerRecord {
  [key: string]: number
}

const timers: TimerRecord = {}

const setTimer = ({ id }: {id: string}) => {
  timers[id] = Date.now()
}

const getTimer = ({ id }: {id: string}) => {
  return timers[id] - Date.now()
}
export { setTimer }
