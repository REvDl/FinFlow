import * as React from "react"
import type { ToastProps } from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 5000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0
function genId() { count = (count + 1) % Number.MAX_SAFE_INTEGER; return count.toString() }

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const dispatch = (action: any) => {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => listener(memoryState))
}

const reducer = (state: any, action: any) => {
  switch (action.type) {
    case "ADD_TOAST": return { ...state, toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) }
    case "DISMISS_TOAST": return { ...state, toasts: state.toasts.map((t: any) => t.id === action.toastId || action.toastId === undefined ? { ...t, open: false } : t) }
    case "REMOVE_TOAST": return { ...state, toasts: state.toasts.filter((t: any) => t.id !== action.toastId) }
    default: return state
  }
}

let memoryState = { toasts: [] as ToasterToast[] }
const listeners: Array<(state: any) => void> = []

export function useToast() {
  const [state, setState] = React.useState(memoryState)
  React.useEffect(() => {
    listeners.push(setState)
    return () => { const index = listeners.indexOf(setState); if (index > -1) listeners.splice(index, 1) }
  }, [state])

  return {
    ...state,
    toast: ({ ...props }: Omit<ToasterToast, "id">) => {
      const id = genId()
      dispatch({ type: "ADD_TOAST", toast: { ...props, id, open: true, onOpenChange: (open: boolean) => { if (!open) dispatch({ type: "DISMISS_TOAST", toastId: id }) } } })
    },
  }
}