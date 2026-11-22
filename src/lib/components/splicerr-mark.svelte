<span class="mark relative isolate block size-9 shrink-0 overflow-hidden rounded-xl" aria-hidden="true">
    <span class="contour shelf"></span>
    <span class="contour bank"></span>
    <span class="contour ridge"></span>
    <span class="contour summit"></span>
</span>

<style>
    .mark {
        background: #172c2c;
        box-shadow: inset 0 0 0 1px #9ac6a23d;
    }

    .contour {
        position: absolute;
        display: block;
        box-shadow: inset 0 0 0 0.75px #e5f3c347;
        transform: rotate(-24deg);
        animation: drift var(--duration) ease-in-out var(--delay) infinite alternate;
    }

    .shelf {
        inset: 10% -22% -18% 3%;
        background: #2e5350;
        border-radius: 46% 54% 60% 40% / 56% 34% 66% 44%;
        --duration: 12s;
        --delay: -4s;
        --x: -13%;
        --y: 7%;
    }

    .bank {
        inset: 20% -8% -3% 15%;
        background: #4d7562;
        border-radius: 48% 52% 61% 39% / 46% 40% 60% 54%;
        --duration: 15s;
        --delay: -9s;
        --x: -13%;
        --y: -8%;
    }

    .ridge {
        inset: 31% 7% 11% 31%;
        background: #83a47a;
        border-radius: 50% 50% 39% 61% / 39% 46% 54% 61%;
        --duration: 13s;
        --delay: -4s;
        --x: -18%;
        --y: -9%;
    }

    .summit {
        inset: 43% 20% 24% 45%;
        background: #c7cb90;
        border-radius: 53% 47% 48% 52% / 53% 40% 60% 47%;
        --duration: 11s;
        --delay: -2s;
        --x: -18%;
        --y: 9%;
    }

    @keyframes drift {
        from { transform: rotate(-24deg) scale(0.96); }
        to { transform: translate(var(--x), var(--y)) rotate(4deg) scale(1.06); }
    }
    @media (prefers-reduced-motion: reduce) {
        .contour { animation: none; }
    }
</style>
