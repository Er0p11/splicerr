<span class="mark flex size-9 shrink-0 items-center justify-center gap-0.5 rounded-xl bg-white/[0.12] shadow-inner"
    aria-hidden="true">
    {#each [0, 1, 2, 3, 4] as bar}
        <span class="bar block w-0.5 rounded-full bg-current"
            style:height={`${8 + (2 - Math.abs(2 - bar)) * 5}px`}
            style:animation-delay={`${-190 * bar}ms`}
            style:animation-duration={`${1900 + 140 * ((bar * 3) % 5)}ms`}></span>
    {/each}
</span>

<style>
    .bar { animation: waveform ease-in-out infinite; }
    @keyframes waveform {
        0%, 100% { transform: scaleY(0.55); }
        38% { transform: scaleY(1); }
        72% { transform: scaleY(0.36); }
    }
    @media (prefers-reduced-motion: reduce) {
        .bar { animation: none; }
    }
</style>
