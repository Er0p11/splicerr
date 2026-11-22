<script lang="ts">
    const outline = "M17 4.8C20.7 5.4 20.8 8.7 24.4 9.6C28.2 10.5 31.7 11.2 32.1 15.6C32.5 19.4 29.3 21.4 27.9 24.7C26.4 28.2 25 31 20.8 31.7C17 32.3 14.5 29.5 11.6 27.3C8.7 25.1 4.8 24.1 4.3 20.2C3.8 16.6 6.7 14.4 8.2 11.3C10 7.8 12.9 4.1 17 4.8Z"
    const contours = [
        { scale: 1, duration: 13, delay: -3 },
        { scale: 0.77, duration: 17, delay: -9 },
        { scale: 0.54, duration: 11, delay: -7 },
        { scale: 0.31, duration: 19, delay: -6 },
    ]
</script>

<span class="mark block size-9 shrink-0 overflow-hidden rounded-xl bg-black" aria-hidden="true">
    <svg viewBox="0 0 36 36" class="block size-full" fill="none" stroke="white" stroke-width="0.8">
        <g class="field">
            {#each contours as { scale, duration, delay } (scale)}
                <path
                    class="contour"
                    d={outline}
                    vector-effect="non-scaling-stroke"
                    style:--scale={scale}
                    style:animation-duration={`${duration}s`}
                    style:animation-delay={`${delay}s`}
                />
            {/each}
        </g>
    </svg>
</span>

<style>
    .field,
    .contour {
        transform-origin: center;
        transform-box: view-box;
    }

    .field {
        animation: drift 23s ease-in-out infinite alternate;
    }

    .contour {
        transform: scale(var(--scale));
        animation: bend ease-in-out infinite alternate;
    }

    @keyframes drift {
        0% { transform: translate(-0.4px, 0) rotate(-7deg); }
        46% { transform: translate(0.55px, -0.5px) rotate(4deg); }
        100% { transform: translate(-0.15px, 0.65px) rotate(12deg); }
    }

    @keyframes bend {
        0% { transform: scale(var(--scale)) rotate(-5deg) scale(0.96, 1); }
        34% { transform: scale(var(--scale)) translate(0.3px, 0.6px) skewY(-9deg) scale(1.02, 0.94); }
        71% { transform: scale(var(--scale)) translate(-0.55px, 0.15px) rotate(8deg) scale(0.96, 1.04); }
        100% { transform: scale(var(--scale)) translate(0.35px, -0.5px) skewY(6deg) scale(1.04, 0.96); }
    }

    @media (prefers-reduced-motion: reduce) {
        .field,
        .contour { animation: none; }
    }
</style>
