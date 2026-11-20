<script lang="ts">
    import FileAudio from "lucide-svelte/icons/file-audio"
    import LoaderCircle from "lucide-svelte/icons/loader-circle"
    import Button from "$lib/components/ui/button/button.svelte"
    import { buttonVariants } from "$lib/components/ui/button"
    import Input from "$lib/components/ui/input/input.svelte"
    import * as Popover from "$lib/components/ui/popover"
    import TransposeDialog from "$lib/components/transpose-dialog.svelte"
    import type { SampleAsset } from "$lib/splice/types"
    import {
        config, isSamplesDirValid, MAX_MANUAL_BPM, MIN_MANUAL_BPM,
        normalizeManualBpm, saveConfig, settingsDialog,
    } from "$lib/shared/config.svelte"
    import { dawSync } from "$lib/shared/daw-sync.svelte"
    import {
        handleSampleDrag, isSampleDragReady, manualDragTempo, prefetchSampleDrag, sampleDragKey, type DragTempo,
    } from "$lib/shared/drag.svelte"
    import { toast } from "$lib/shared/toasts.svelte"

    let { asset }: { asset: SampleAsset | null } = $props()
    let open = $state(false)
    let draftBpm = $state<number | undefined>(120)
    const bridgeBpm = $derived(Math.round((dawSync.bpm ?? 0) * 100) / 100)
    const tempo = $derived.by((): DragTempo | null => {
        if (dawSync.connected) return bridgeBpm ? { source: "bridge", bpm: bridgeBpm } : null
        return manualDragTempo(asset) ?? null
    })
    const preparationKey = $derived(asset && tempo ? sampleDragKey(asset, tempo) : null)
    let preparation = $state<{ key: string; status: "loading" | "ready" | "failed" } | null>(null)
    const status = $derived.by(() => {
        if (!asset || !tempo || !isSamplesDirValid()) return null
        if (isSampleDragReady(asset, tempo)) return "ready"
        return preparation?.key === preparationKey ? preparation.status : null
    })

    async function prepare() {
        if (!asset || !tempo || !preparationKey || !isSamplesDirValid()) return
        if (status === "loading" || status === "ready") return
        const key = preparationKey
        preparation = { key, status: "loading" }
        const files = await prefetchSampleDrag(asset, tempo)
        if (preparation?.key === key) {
            preparation = { key, status: files ? "ready" : "failed" }
        }
    }

    function setManualBpm(bpm: number | null) {
        config.manual_bpm = bpm
        open = false
        void saveConfig().catch((error) => {
            console.error("Could not save BPM setting", error)
            toast({ title: "Could not save BPM setting", variant: "error" })
        })
    }
</script>

{#if !dawSync.connected}
    <Popover.Root bind:open onOpenChange={(isOpen) => {
        if (isOpen) draftBpm = config.manual_bpm ?? asset?.bpm ?? 120
    }}>
        <Popover.Trigger
            class={buttonVariants({ variant: "outline", class: "shrink-0 tabular-nums" })}
            title="Set preview tempo"
        >
            {config.manual_bpm ? `Align · ${config.manual_bpm} BPM` : "Align BPM"}
        </Popover.Trigger>
        <Popover.Content align="end" side="top" class="w-72 max-h-[80vh] overflow-y-auto">
            <form class="flex flex-col gap-3" onsubmit={(event) => {
                event.preventDefault()
                const bpm = normalizeManualBpm(draftBpm)
                if (bpm !== null) setManualBpm(bpm)
            }}>
                <label for="manual-tempo" class="text-sm font-medium">Target BPM</label>
                <Input id="manual-tempo" type="number" min={MIN_MANUAL_BPM} max={MAX_MANUAL_BPM}
                    step={0.1} required bind:value={draftBpm} />
                {#if asset && !asset.bpm}
                    <p class="text-xs text-muted-foreground">This sample has no BPM metadata.</p>
                {:else if asset && config.manual_bpm && !tempo}
                    <p class="text-xs text-muted-foreground">The current target is outside this sample’s preview range.</p>
                {/if}
                <div class="flex flex-wrap justify-end gap-2">
                    {#if config.manual_bpm}
                        <Button type="button" variant="ghost" onclick={() => setManualBpm(null)}>Use original</Button>
                    {/if}
                    <Button type="submit">Apply BPM</Button>
                </div>
            </form>
            <label class="mt-3 flex items-start gap-2 text-sm">
                <input class="mt-0.5" type="checkbox" checked={config.prepare_aligned_wavs}
                    onchange={(event) => {
                        config.prepare_aligned_wavs = event.currentTarget.checked
                        void saveConfig().catch((error) => {
                            console.error("Could not save WAV setting", error)
                            toast({ title: "Could not save WAV setting", variant: "error" })
                        })
                    }} />
                <span>
                    <span class="block font-medium">Pre-render aligned WAVs</span>
                    <span class="block text-xs text-muted-foreground">
                        Prepare the selected and buffered samples for drag to DAW. Saves WAVs in Samples Directory.
                    </span>
                </span>
            </label>
            <details class="mt-3 border-t border-border pt-3">
                <summary class="cursor-pointer text-sm font-medium">Transpose settings</summary>
                <div class="mt-3"><TransposeDialog embedded /></div>
            </details>
        </Popover.Content>
    </Popover.Root>
{/if}

{#if asset && tempo}
    <button
        type="button"
        class={[
            "flex h-11 w-36 shrink-0 items-center gap-2 rounded-lg border border-primary/35 bg-primary/10 px-3 text-left text-sm hover:bg-primary/20",
            status === "ready" && "cursor-grab active:cursor-grabbing",
        ]}
        draggable={status === "ready"}
        title={status === "ready" ? "Drag the WAV into your DAW" : "Prepare a tempo-aligned WAV"}
        onmouseenter={() => status !== "failed" && void prepare()}
        onfocus={() => status !== "failed" && void prepare()}
        onclick={() => {
            if (!isSamplesDirValid()) settingsDialog.open = true
            else void prepare()
        }}
        ondragstart={(event) => handleSampleDrag(event, asset!, tempo!)}
    >
        {#if status === "loading"}
            <LoaderCircle class="size-5 animate-spin" />
        {:else}
            <FileAudio class="size-5" />
        {/if}
        <span class="flex flex-col leading-tight">
            <span class="font-semibold">
                {status === "loading" ? "Preparing…" : status === "failed" ? "Retry WAV" : "Drag WAV"}
            </span>
            <span class="text-xs tabular-nums text-muted-foreground">{tempo.bpm} BPM</span>
        </span>
    </button>
{/if}
