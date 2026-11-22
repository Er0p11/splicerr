import { open } from "@tauri-apps/plugin-dialog"
import { join } from "@tauri-apps/api/path"
import { SvelteMap } from "svelte/reactivity"
import { fetchAllPackSamples } from "$lib/splice/packs"
import type { PackAsset } from "$lib/splice/types"
import { config, isSamplesDirValid, settingsDialog } from "./config.svelte"
import { originalWavPath, safePathPart, saveOriginalWav } from "./files.svelte"

export const packDownloads = new SvelteMap<string, { done: number; total: number }>()
export const packDownloadResults = new SvelteMap<string, { summary: string; directory?: string }>()

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
        packDownloadResults.delete(pack.uuid)

        const directory = await join(parent, safePathPart(pack.name))
        const samples = await fetchAllPackSamples(pack.uuid)
        if (!samples.length) throw new Error("This pack has no downloadable sample previews.")

        const usedPaths = new Set<string>()
        let done = 0
        let failed = 0
        const files = samples.map((sample) => {
            let relative = originalWavPath(sample)
            for (let copy = 2; usedPaths.has(relative.toLowerCase()); copy++) {
                relative = originalWavPath(sample, `_${copy}`)
            }
            usedPaths.add(relative.toLowerCase())
            return { sample, relative }
        })
        packDownloads.set(pack.uuid, { done, total: files.length })
        for (let start = 0; start < files.length;) {
            const batch = files.slice(start, start + config.parallel_sample_downloads)
            await Promise.all(batch.map(async ({ sample, relative }) => {
                try {
                    await saveOriginalWav(sample, await join(directory, relative))
                } catch (error) {
                    failed++
                    console.error("Could not save pack sample", sample.uuid, error)
                } finally {
                    packDownloads.set(pack.uuid, { done: ++done, total: files.length })
                }
            }))
            start += batch.length
        }

        if (failed === samples.length) throw new Error("Could not save any sample files.")
        packDownloadResults.set(pack.uuid, {
            summary: failed ? `${samples.length - failed} of ${samples.length} WAVs saved` : `${samples.length} WAVs saved`,
            directory,
        })
    } catch (error) {
        console.error("Could not download pack", pack.uuid, error)
        packDownloadResults.set(pack.uuid, {
            summary: error instanceof Error ? error.message : "Pack download failed.",
        })
    } finally {
        packDownloads.delete(pack.uuid)
    }
}
