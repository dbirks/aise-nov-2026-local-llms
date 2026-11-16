// A2b — LLM-written .mjs generator run directly by splat-transform (Beta generator API).
//
//   pnpx @playcanvas/splat-transform@3.11.2 -w tools/splats/a2/attn-mask.mjs \
//       -p n=26,sample=0.075 -s 0.1547 public/splats/a2/attn-mask.spz
//
// Scene: a causal attention mask as a field of n x n tiles. Tiles on the diagonal and
// below (key index <= query index) are solid slabs; tiles above the diagonal are light
// wire outlines — they are masked out, so nothing is drawn there but the ghost outline.
// The last query row (the token being decoded) is lifted and brightened. ILLUSTRATIVE:
// one square per token pair, not real attention weights.
//
// The generator path is calibrated against splat-transform 3.11.2 (see README):
// emitted positions come out as (-x, -y, z) and rot_* maps onto the standard PLY
// quaternion (w,x,y,z) as w=rot_3, x=rot_2, y=-rot_1, z=-rot_0. So emit() flips x/y
// and the quaternion table below is written in the intended final world frame.

const SH_C0 = 0.28209479177387814;
const packClr = (c) => (c - 0.5) / SH_C0;
const packOpacity = (a) => (a <= 0 ? -20 : a >= 1 ? 20 : Math.log(a / (1 - a)));

// flat disc: local +z (scale_2) points along `n`
const NORMALS = {
    '+y': [0.70710678, -0.70710678, 0, 0],
    '-y': [0.70710678, 0.70710678, 0, 0],
    '+x': [0.70710678, 0, 0.70710678, 0],
    '-x': [0.70710678, 0, -0.70710678, 0],
    '+z': [1, 0, 0, 0],
    '-z': [0, 1, 0, 0]
};
const QUATS = {};
for (const key in NORMALS) {
    const [w, x, y, z] = NORMALS[key];
    QUATS[key] = [-z, -y, x, w]; // rot_0..rot_3 for the generator API
}

class Generator {
    constructor(o) {
        const n = o.n, pitch = o.pitch, tile = o.tile, depth = o.depth, sp = o.sample;
        let seed = o.seed;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        const half = (n - 1) / 2;
        const k = Math.max(2, Math.round(tile / sp));
        const xs = [], ys = [], zs = [], cols = [], ns = [];
        // (X, Y, Z, N) are written in the intended final world frame
        const emit = (X, Y, Z, c, nrm) => {
            xs.push(-X); ys.push(-Y); zs.push(Z); cols.push(c); ns.push(nrm);
        };

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                const attended = j <= i;
                const last = i === n - 1; // the token currently decoding
                const cx = (j - half) * pitch;
                const cz = (i - half) * pitch;
                const cy = last ? depth * 1.8 : 0;
                const u = 0.5 * tile;
                const lum = attended ? (last ? 0.62 : 0.3 + 0.22 * rand()) : 0.93;

                if (attended) {
                    // top and bottom faces
                    for (let a = 0; a < k; a++) {
                        for (let b = 0; b < k; b++) {
                            const px = cx - u + (a + 0.5) * tile / k + (rand() - 0.5) * sp * 0.5;
                            const pz = cz - u + (b + 0.5) * tile / k + (rand() - 0.5) * sp * 0.5;
                            emit(px, cy + depth / 2, pz, lum, '+y');
                            emit(px, cy - depth / 2, pz, lum * 0.45, '-y');
                        }
                    }
                    // four side walls
                    for (let a = 0; a < k; a++) {
                        const t = cx - u + (a + 0.5) * tile / k;
                        const s = cz - u + (a + 0.5) * tile / k;
                        emit(t, cy, cz - u, lum * 0.7, '-z');
                        emit(t, cy, cz + u, lum, '+z');
                        emit(cx - u, cy, s, lum * 0.6, '-x');
                        emit(cx + u, cy, s, lum * 0.8, '+x');
                    }
                } else {
                    // masked: ghost outline of the tile only
                    for (let a = 0; a < k; a++) {
                        const t = cx - u + (a + 0.5) * tile / k;
                        const s = cz - u + (a + 0.5) * tile / k;
                        emit(t, cy, cz - u, lum, '+z');
                        emit(t, cy, cz + u, lum, '+z');
                        emit(cx - u, cy, s, lum, '+x');
                        emit(cx + u, cy, s, lum, '+x');
                    }
                }
            }
        }

        this.count = xs.length;
        this.columnNames = ['x', 'y', 'z', 'scale_0', 'scale_1', 'scale_2',
            'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity', 'rot_0', 'rot_1', 'rot_2', 'rot_3'];
        this.data = { xs, ys, zs, cols, ns };
        this.s = Math.log(sp * 0.72);
        this.st = Math.log(sp * 0.09);
        this.alpha = packOpacity(0.97);
    }

    getRow(index, row) {
        const d = this.data;
        row.x = d.xs[index];
        row.y = d.ys[index];
        row.z = d.zs[index];
        const q = QUATS[d.ns[index]];
        row.scale_0 = this.s;
        row.scale_1 = this.s;
        row.scale_2 = this.st;
        const c = packClr(d.cols[index]);
        row.f_dc_0 = c;
        row.f_dc_1 = c;
        row.f_dc_2 = c;
        row.opacity = this.alpha;
        row.rot_0 = q[0];
        row.rot_1 = q[1];
        row.rot_2 = q[2];
        row.rot_3 = q[3];
    }

    static create(params) {
        const get = (name, def) => params.find(p => p.name === name)?.value ?? def;
        const o = {
            n: Math.floor(+get('n', 26)),
            pitch: +get('pitch', 1.0),
            tile: +get('tile', 0.84),
            depth: +get('depth', 0.1),
            sample: +get('sample', 0.075),
            seed: Math.floor(+get('seed', 7)) || 7
        };
        console.log(`attn-mask: n=${o.n} pitch=${o.pitch} tile=${o.tile} depth=${o.depth} sample=${o.sample}`);
        return new Generator(o);
    }
}

export { Generator };
