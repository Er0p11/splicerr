<script lang="ts">
    import { cn } from "$lib/utils"
    import Button from "$lib/components/ui/button/button.svelte"
    import Play from "lucide-svelte/icons/play"
    import Pause from "lucide-svelte/icons/pause"
    import SkipForward from "lucide-svelte/icons/skip-forward"
    import SkipBack from "lucide-svelte/icons/skip-back"
    import { globalAudio } from "$lib/shared/audio.svelte"
    import type { MouseEventHandler } from "svelte/elements"
    import LoaderCircle from "lucide-svelte/icons/loader-circle"
    import { loading } from "$lib/shared/loading.svelte"
    import PackPreview from "$lib/components/pack-preview.svelte"
    import * as Tooltip from "$lib/components/ui/tooltip"
    import { dataStore, fetchAssets } from "$lib/shared/store.svelte"
    import TagBadge from "$lib/components/tag-badge.svelte"
    import { assetIcons } from "$lib/shared/icons.svelte"
    import CircleX from "lucide-svelte/icons/circle-x"
    import VolumeX from "lucide-svelte/icons/volume-x"
    import Volume1 from "lucide-svelte/icons/volume-1"
    import Volume2 from "lucide-svelte/icons/volume-2"
    import Cable from "lucide-svelte/icons/cable"
    import TempoControls from "$lib/components/tempo-controls.svelte"
    import { config } from "$lib/shared/config.svelte"
    import { manualTempoRatio } from "$lib/shared/tempo"
    import { windowView } from "$lib/shared/window-view.svelte"
    import TransposeDialog from "$lib/components/transpose-dialog.svelte"
    import {
        dawSync,
        toggleDawSyncedPlayback,
    } from "$lib/shared/daw-sync.svelte"

    let {
        class: className,
        onnext,
        onprev,
        ...restProps
    }: {
        class?: string
        onnext: MouseEventHandler<HTMLButtonElement> &
            MouseEventHandler<HTMLAnchorElement>
        onprev: MouseEventHandler<HTMLButtonElement> &
            MouseEventHandler<HTMLAnchorElement>
    } = $props()

    const currentPack = $derived(globalAudio.currentAsset?.parents.items[0])
    const currentName = $derived(globalAudio.currentAsset?.name.split("/").slice(-1)[0])
    const dawStatusLabel = $derived(
        !dawSync.connected
            ? "DAW off"
            : dawSync.waitingForBar
              ? `Bar ${dawSync.nextPhraseBarNumber}`
              : `${Math.round(dawSync.bpm ?? 0)} BPM`
    )
    const dawStatusTitle = $derived(
        !dawSync.connected
            ? "Splicerr Bridge not connected"
            : dawSync.waitingForBar
              ? `Waiting for 4-bar phrase at bar ${dawSync.nextPhraseBarNumber}`
              : `Connected: ${dawSync.bpm?.toFixed(2) ?? "--"} BPM, bar ${dawSync.barNumber}`
    )
    const previewRate = $derived(manualTempoRatio(globalAudio.currentAsset, config.manual_bpm) ?? 1)

    $effect(() => {
        if (!dawSync.connected && globalAudio.ref) {
            globalAudio.ref.preservesPitch = true
            globalAudio.ref.playbackRate = previewRate
        }
    })

    const progressCurrentTime = $derived(
        dawSync.connected ? dawSync.visualCurrentTime : globalAudio.currentTime / previewRate
    )
    const progressDuration = $derived(
        dawSync.connected
            ? dawSync.visualDuration || 0
            : (globalAudio.duration || 0) / previewRate
    )
    const progressRatio = $derived(
        progressDuration > 0 ? progressCurrentTime / progressDuration : 0
    )
    const playbackPaused = $derived(
        dawSync.connected ? !dawSync.playbackEnabled : globalAudio.paused
    )

    function handleProgressInput(event: Event) {
        if (dawSync.connected) return
        globalAudio.currentTime = Number((event.currentTarget as HTMLInputElement).value) * previewRate
    }
</script>

<div
    class={cn(
        "glass-panel mx-3 mt-3 flex h-[74px] w-[calc(100%-1.5rem)] flex-shrink-0 flex-col overflow-hidden rounded-[24px]",
        className
    )}
    {...restProps}
>
    <audio
        bind:this={globalAudio.ref}
        bind:paused={globalAudio.paused}
        bind:currentTime={globalAudio.currentTime}
        bind:duration={globalAudio.duration}
        bind:volume={globalAudio.volume}
    ></audio>
    <input
        aria-label="Preview position"
        style="--progress: {progressRatio * 100 || 0}%"
        type="range"
        class="slider-nothumb h-1.5"
        min={0}
        max={progressDuration}
        step="any"
        value={progressCurrentTime}
        oninput={handleProgressInput}
        onclick={() => {
            if (!dawSync.connected && globalAudio.currentAsset && globalAudio.paused) globalAudio.togglePlay()
        }}
    />
    <div class="flex min-h-0 flex-1 items-center justify-between py-2.5 px-3 gap-2">
        <div class={cn("flex", windowView.compact ? "gap-0.5" : "gap-1.5")}>
            <Button
                variant="ghost"
                size={windowView.compact ? "icon" : "icon-lg"}
                class="rounded-full"
                onclick={onprev}
                disabled={!globalAudio.currentAsset}><SkipBack /></Button
            >
            <Button
                variant="ghost"
                size={windowView.compact ? "icon" : "icon-lg"}
                class="rounded-full bg-white/[0.12] hover:bg-white/[0.18]"
                onclick={() => toggleDawSyncedPlayback()}
                disabled={!globalAudio.currentAsset}
            >
                {#if globalAudio.loading || (dawSync.connected && loading.samplesCount > 0 && loading.samples.has(globalAudio.currentAsset?.uuid ?? ""))}
                    <LoaderCircle class="animate-spin" />
                {:else if playbackPaused}
                    <Play />
                {:else}
                    <Pause />
                {/if}
            </Button>
            <Button
                variant="ghost"
                size={windowView.compact ? "icon" : "icon-lg"}
                class="rounded-full"
                onclick={onnext}
                disabled={!globalAudio.currentAsset}><SkipForward /></Button
            >
        </div>
        {#if globalAudio.currentAsset && !windowView.compact}
            <div class="flex gap-2 items-center flex-1 min-w-0">
                <PackPreview side="top" pack={currentPack} />
                <div class="text-muted-foreground">
                    {#if globalAudio.currentAsset.asset_category_slug in assetIcons}
                        {@const Icon =
                            assetIcons[
                                globalAudio.currentAsset.asset_category_slug
                            ]}
                        <Icon class="group-hover:hidden" />
                    {:else}
                        <CircleX class="group-hover:hidden" />
                    {/if}
                </div>
                <div class="min-w-0 overflow-clip">
                    <div
                        class="text-left pr-4 relative after:content-[''] after:absolute after:inset-y-0 after:right-0 after:w-5 after:bg-gradient-to-r after:from-transparent after:to-background/0 after:pointer-events-none"
                    >
                        <Tooltip.Provider>
                            <Tooltip.Root>
                                <Tooltip.Trigger
                                    class="overflow-clip text-nowrap cursor-grab text-sm font-medium"
                                >
                                    {currentName}
                                </Tooltip.Trigger>
                                <Tooltip.Content>
                                    {currentName}
                                </Tooltip.Content>
                            </Tooltip.Root>
                        </Tooltip.Provider>
                        <div
                            class="flex gap-1 text-xs overflow-clip text-nowrap pr-2 pt-1"
                        >
                            {#each globalAudio.currentAsset.tags as tag}
                                {@const active = dataStore.tags.includes(
                                    tag.uuid
                                )}
                                {@const tag_summary_tag =
                                    dataStore.tag_summary.find(
                                        (t: any) => t.tag.uuid == tag.uuid
                                    )}
                                <TagBadge
                                    label={tag.label}
                                    variant="ghost"
                                    class="h-6 px-2 py-0 text-[11px]"
                                    count={tag_summary_tag?.count ?? 0}
                                    onclick={() => {
                                        if (!active) {
                                            dataStore.tags.push(tag.uuid)
                                            // updateTagSummary()
                                            fetchAssets()
                                        }
                                    }}
                                />
                            {/each}
                        </div>
                    </div>
                </div>
            </div>
        {/if}
        <div class="flex items-center gap-2">
            <Tooltip.Provider>
                <Tooltip.Root>
                    <Tooltip.Trigger
                        class={cn(
                            "hidden sm:flex h-9 items-center gap-1.5 rounded-md px-2 text-xs font-medium tabular-nums",
                            windowView.compact && "sm:hidden",
                            dawSync.connected
                                ? dawSync.waitingForBar
                                  ? "glass-pill text-foreground"
                                  : "glass-pill text-foreground"
                                : "text-muted-foreground"
                        )}
                    >
                        <Cable class="size-4" />
                        <span>{dawStatusLabel}</span>
                    </Tooltip.Trigger>
                    <Tooltip.Content>
                        {dawStatusTitle}
                    </Tooltip.Content>
                </Tooltip.Root>
            </Tooltip.Provider>
            <TempoControls asset={globalAudio.currentAsset} />
            {#if !windowView.compact}<TransposeDialog />{/if}
            <Button
                variant="ghost"
                size={windowView.compact ? "icon" : "icon-lg"}
                class="shrink-0 rounded-full"
                onclick={() => globalAudio.toggleMute()}
            >
                {#if globalAudio.volume == 0}
                    <VolumeX />
                {:else if globalAudio.volume < 0.5}
                    <Volume1 />
                {:else}
                    <Volume2 />
                {/if}
            </Button>
            {#if !windowView.compact}
                <div class="hidden w-16 md:block">
                    <input
                        style="--progress: {globalAudio.volume * 100}%"
                        type="range"
                        class="slider-nothumb h-1.5 rounded-full"
                        aria-label="Preview volume"
                        min={0}
                        max={1}
                        step="any"
                        bind:value={globalAudio.volume}
                    />
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .slider-nothumb {
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
        cursor: pointer;
        width: 100%;
        overflow: clip;
    }

    .slider-nothumb:focus {
        outline: none;
    }

    .slider-nothumb-track {
        height: 100%;
        background: linear-gradient(
            to right,
            theme("colors.muted.foreground") 0%,
            theme("colors.muted.foreground") calc(var(--progress, 0%)),
            theme("colors.muted.DEFAULT") calc(var(--progress, 0%)),
            theme("colors.muted.DEFAULT") 100%
        );
    }

    .slider-nothumb-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 1rem;
        height: 100%;
        opacity: 0;
    }

    .slider-nothumb::-webkit-slider-runnable-track {
        @apply slider-nothumb-track;
    }

    .slider-nothumb::-webkit-slider-thumb {
        @apply slider-nothumb-thumb;
    }

    .slider-nothumb:focus::-webkit-slider-thumb {
        @apply slider-nothumb-thumb;
    }

    .slider-nothumb::-moz-range-track {
        @apply slider-nothumb-track;
    }

    .slider-nothumb::-moz-range-thumb {
        @apply slider-nothumb-thumb;
    }

    .slider-nothumb:focus::-moz-range-thumb {
        @apply slider-nothumb-thumb;
    }
</style>
