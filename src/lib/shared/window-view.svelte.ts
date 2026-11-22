import { currentMonitor, getCurrentWindow, LogicalSize } from "@tauri-apps/api/window"
import { config, saveConfig } from "./config.svelte"

const COMPACT_WIDTH = 500
let wasMaximized = false

export const windowView = $state({ compact: false, changingSize: false, changingPin: false })

function reportWindowError(error: unknown) {
    console.error("Could not update window", error)
}

export async function restoreWindowView() {
    windowView.compact = config.compact_view === true
    if (config.always_on_top === true) {
        await getCurrentWindow().setAlwaysOnTop(true).catch(reportWindowError)
    }
}

export async function toggleAlwaysOnTop() {
    if (windowView.changingPin) return
    windowView.changingPin = true
    try {
        const next = !config.always_on_top
        await getCurrentWindow().setAlwaysOnTop(next)
        config.always_on_top = next
        await saveConfig()
    } catch (error) {
        reportWindowError(error)
    } finally {
        windowView.changingPin = false
    }
}

export async function toggleCompactView() {
    if (windowView.changingSize) return
    windowView.changingSize = true
    const win = getCurrentWindow()
    try {
        const compact = !windowView.compact
        if (compact) {
            wasMaximized = await win.isMaximized()
            if (wasMaximized) await win.unmaximize()
        }

        const [physicalSize, scale, monitor] = await Promise.all([
            win.innerSize(), win.scaleFactor(), currentMonitor(),
        ])
        const size = physicalSize.toLogical(scale)
        const availableWidth = monitor?.workArea.size.toLogical(monitor.scaleFactor).width ?? Infinity
        const width = compact ? Math.min(COMPACT_WIDTH, size.width) : config.expanded_width
        await win.setSize(new LogicalSize(Math.min(width, availableWidth), size.height))
        if (!compact && wasMaximized) await win.maximize()

        if (compact) config.expanded_width = size.width
        windowView.compact = compact
        config.compact_view = compact
        await saveConfig()
    } catch (error) {
        reportWindowError(error)
    } finally {
        windowView.changingSize = false
    }
}
