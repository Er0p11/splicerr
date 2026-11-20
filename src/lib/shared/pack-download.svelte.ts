import { open } from "@tauri-apps/plugin-dialog"
import { join } from "@tauri-apps/api/path"
import { revealItemInDir } from "@tauri-apps/plugin-opener"
import { SvelteMap } from "svelte/reactivity"
import { fetchAllPackSamples } from "$lib/splice/packs"
import type { PackAsset } from "$lib/splice/types"
import { config, isSamplesDirValid, settingsDialog } from "./config.svelte"
import { originalWavPath, safePathPart, saveOriginalWav } from "./files.svelte"
import { toast } from "./toasts.svelte"

export const packDownloads = new SvelteMap<string, { done: number; total: number }>()

export async function downloadPack(pack: PackAsset, chooseFolder: boolean) {
    if (packDownloads.has(pack.uuid)) return
    if (!chooseFolder && !isSamplesDirValid()) {
        settingsDialog.open = true
        return
    }

    packDownloads.set(pack.uuid, { done: 0, total: 0 })
    try {
        const parent = chooseFolder
            ? await open({ directory: true, multiple: false, title: "Choose a folder for the pack" })
            : config.samples_dir
        if (!parent) return

        const directory = await join(parent, safePathPart(pack.name))
        const samples = await fetchAllPackSamples(pack.uuid)
        if (!samples.length) throw new Error("This pack has no downloadable sample previews.")

        const usedPaths = new Set<string>()
        let failed = 0
        for (const [index, sample] of samples.entries()) {
            packDownloads.set(pack.uuid, { done: index, total: samples.length })
            let relative = originalWavPath(sample)
            for (let copy = 2; usedPaths.has(relative.toLowerCase()); copy++) {
                relative = originalWavPath(sample, `_${copy}`)
            }
            usedPaths.add(relative.toLowerCase())
            try {
                await saveOriginalWav(sample, await join(directory, relative))
            } catch (error) {
                failed++
                console.error("Could not save pack sample", sample.uuid, error)
            }
        }

        if (failed === samples.length) throw new Error("Could not save any sample files.")
        toast({
            title: failed ? "Pack download partially completed" : "Pack downloaded",
            description: `${samples.length - failed} of ${samples.length} WAVs · ${pack.name}`,
            variant: failed ? "default" : "success",
            onClick: () => revealItemInDir(directory),
        })
    } catch (error) {
        toast({
            title: "Pack download failed",
            description: error instanceof Error ? error.message : String(error),
            variant: "error",
        })
    } finally {
        packDownloads.delete(pack.uuid)
    }
}
