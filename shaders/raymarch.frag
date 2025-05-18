#version 330 core
out vec4 FragColor;
in  vec2 fragCoord;

uniform vec2  iResolution;          // 屏幕分辨率
uniform float iTime;                // 时间（可做动画）

uniform samplerBuffer objectBuffer; // TBO 采样器
uniform int           numObjects;   // 物体数量

float sdSphere(vec3 p, float r)
{
    return length(p) - r;
}
float sdBox(vec3 p, float alpha, float beta, float gamma, vec3 b)
{
    // rotate around Z axis
    mat3 Rz_alpha = mat3(
        cos(alpha), -sin(alpha), 0.0,
        sin(alpha),  cos(alpha), 0.0,
        0.0,         0.0,        1.0
    );

    // rotate around X axis
    mat3 Rx_beta = mat3(
        1.0,         0.0,        0.0,
        0.0,         cos(beta), -sin(beta),
        0.0,         sin(beta),  cos(beta)
    );

    // rotate around Z axis
    mat3 Rz_gamma = mat3(
        cos(gamma), -sin(gamma), 0.0,
        sin(gamma),  cos(gamma), 0.0,
        0.0,         0.0,        1.0
    );

    mat3 R = Rz_gamma * Rx_beta * Rz_alpha;
    vec3 q = abs(R * p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r)
{
    vec3 pa = p - a,  ba = b - a;
    float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
    return length(pa - ba*h) - r;
}

float sdCylinderFlat(vec3 p, vec3 a, vec3 b, float r)
{
    vec3  ba   = b - a;
    float h2   = length(ba) * 0.5;
    vec3  axis = ba / (h2 * 2.0);
    vec3  mid  = (a + b) * 0.5;

    vec3 up  = abs(axis.z) < 0.999 ? vec3(0,0,1) : vec3(1,0,0);
    vec3 x   = normalize(cross(up, axis));
    vec3 y   = cross(axis, x);

    vec3 lp = vec3(dot(p - mid, x),
                   dot(p - mid, y),
                   dot(p - mid, axis));     // lp.z ∈ [-h2, h2]

    vec2 d = abs(vec2(length(lp.xy), lp.z)) - vec2(r, h2);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float sdCone(vec3 p, vec2 c, float h)
{
    vec2 q = h * vec2(c.x / c.y, -1.0);

    vec2 w = vec2(length(p.xz), p.y);
    vec2 a = w - q * clamp(dot(w,q) / dot(q,q), 0.0, 1.0);
    vec2 b = w - q * vec2(clamp(w.x / q.x, 0.0, 1.0), 1.0);
    float k = sign(q.y);
    float d = min(dot(a, a), dot(b, b));
    float s = max(k * (w.x * q.y - w.y * q.x), k * (w.y - q.y));
    return sqrt(d) * sign(s);
}

float sqrLength(vec3 v) {
    return dot(v, v);
}

float sdTriangle(vec3 p, vec3 a, vec3 b, vec3 c) {
    vec3 ba = b - a; vec3 pa = p - a;
    vec3 cb = c - b; vec3 pb = p - b;
    vec3 ac = a - c; vec3 pc = p - c;
    vec3 nor = cross(ba, ac);

    return sqrt(
        min(min(
            sqrLength(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)),
            sqrLength(pb - cb * clamp(dot(pb, cb) / dot(cb, cb), 0.0, 1.0))),
            sqrLength(pc - ac * clamp(dot(pc, ac) / dot(ac, ac), 0.0, 1.0)))
    + (dot(nor, pa) * dot(nor, pa)) / dot(nor, nor));
}

float sdTetrahedron(vec3 p, vec3 v0, vec3 v1, vec3 v2, vec3 v3)
{
    vec3 cen = (v0+v1+v2+v3)*0.25;

    vec3 n0 = normalize(cross(v1-v0, v2-v0));
    if(dot(cen - v0, n0) > 0.0) n0 = -n0;

    vec3 n1 = normalize(cross(v2-v0, v3-v0));
    if(dot(cen - v0, n1) > 0.0) n1 = -n1;

    vec3 n2 = normalize(cross(v3-v0, v1-v0));
    if(dot(cen - v0, n2) > 0.0) n2 = -n2;

    vec3 n3 = normalize(cross(v1-v2, v3-v2));
    if(dot(cen - v2, n3) > 0.0) n3 = -n3;

    float d0 = dot(p - v0, n0);
    float d1 = dot(p - v0, n1);
    float d2 = dot(p - v0, n2);
    float d3 = dot(p - v2, n3);

    if(d0<=0.0 && d1<=0.0 && d2<=0.0 && d3<=0.0)
        return max(max(d0, max(d1,d2)), d3);

    float dist0 = sdTriangle(p, v0, v1, v2);
    float dist1 = sdTriangle(p, v0, v2, v3);
    float dist2 = sdTriangle(p, v0, v3, v1);
    float dist3 = sdTriangle(p, v1, v2, v3);
    return min(min(dist0, dist1), min(dist2, dist3));
}

float distOne(int idx, vec3 p, out vec3 objColor)
{
    const int STRIDE = 8;               // 8 × vec4
    int base = idx * STRIDE;

    vec4 t0 = texelFetch(objectBuffer, base + 0);   // type & RGB
    vec4 t1 = texelFetch(objectBuffer, base + 1);   // A + pos0~2
    vec4 t2 = texelFetch(objectBuffer, base + 2);   // pos3~6
    vec4 t3 = texelFetch(objectBuffer, base + 3);   // pos7~10
    vec4 t4 = texelFetch(objectBuffer, base + 4);

    int  type = int(t0.x + 0.5);
    objColor  = t0.yzw;                 // rgb

    if (type == 0)                      /* ---------- SPHERE ---------- */
    {
        vec3 center = t1.yzw;           // (pos0~2)
        float radius = t2.x;            // (pos3)
        return sdSphere(p - center, radius);
    }
    else if (type == 1)               /* ------------ CONE -------------*/
    {
        vec3 center = t1.yzw;           // (pos0~2)
        vec3 vertex = t2.xyz;           // (pos3~5)
        float radius = t2.w;            // (pos6)

        vec3 axis = normalize(center - vertex);
        float height = length(center - vertex);

        vec3 up = abs(axis.y) < 0.999 ? vec3(0,1,0) : vec3(1,0,0);
        vec3 x  = normalize(cross(up, axis));
        vec3 z  = cross(axis, x);

        mat3 basis = mat3(x, -axis, z);

        vec3 p_local = transpose(basis) * (p - vertex);

        float angle = atan(radius, height);
        vec2  c     = vec2(sin(angle), cos(angle));

        return sdCone(p_local, c, height);

    }
    else if (type == 2)               /* ---------- CYLINDER ---------- */
    {
        vec3 a       = t1.yzw;
        vec3 b       = t2.xyz;
        float radius = t2.w;
        return sdCylinderFlat(p, a, b, radius);
    }
    else if (type == 3)                 /* ---------- CUBOID ---------- */
    {
        vec3 center   = t1.yzw;                     // (pos0~2)
        float alpha = t2.w;                        // (pos6)
        float beta  = t3.x;                        // (pos7)
        float gamma = t3.y;                        // (pos8)
        vec3 halfExt  = vec3(t2.x, t2.y, t2.z) * 0.5;  // (pos3~5)
        return sdBox(p - center, alpha, beta, gamma, halfExt);
    }
    else if (type == 4)                 /* ---------- Tetrahedron ---------- */
    {
        vec3 v0 = t1.yzw;                     // (pos0~2)
        vec3 v1 = t2.xyz;                     // (pos3~5)
        vec3 v2 = vec3(t2.w, t3.x, t3.y); // (pos6~8)
        vec3 v3 = vec3(t3.z, t3.w, t4.x); // (pos9~11)
        return sdTetrahedron(p, v0, v1, v2, v3);
    }
    return 1e6;     
}                   

float map(vec3 p, out vec3 col)
{
    float dMin = 1e9;
    col = vec3(0.0);
    for (int i = 0; i < numObjects; ++i)
    {
        vec3 c;
        float d = distOne(i, p, c);
        if (d < dMin)
        {
            dMin = d;
            col  = c;
        }
    }
    return dMin;
}

vec3 calcNormal(vec3 p)
{
    const float h = 1e-3;
    vec3 dummy;
    vec2 k = vec2(1.0, -1.0);
    return normalize(
          k.xyy * map(p + k.xyy * h, dummy)
        + k.yyx * map(p + k.yyx * h, dummy)
        + k.yxy * map(p + k.yxy * h, dummy)
        + k.xxx * map(p + k.xxx * h, dummy)
    );
}

float march(vec3 ro, vec3 rd, out vec3 pos, out vec3 col)
{
    const float EPS  = 1e-4;
    const float TMAX = 100.0;
    float t = 0.0;
    for (int i = 0; i < 128; ++i)
    {
        pos = ro + rd * t;
        float d = map(pos, col);
        if (d < EPS) return t;          // hit
        t += d;
        if (t > TMAX) break;            // clipped
    }
    return -1.0;                       
}

void main()
{
    /* 1) Ray */
    vec2 uv = (fragCoord * 2.0 - 1.0);
    uv.x *= iResolution.x / iResolution.y;

    vec3 ro = vec3(0.0, 0.0, -5.0);     // camera pos
    vec3 rd = normalize(vec3(uv, 1.0)); // ray dir

    /* 2) Ray March */
    vec3 hitPos, baseCol;
    float t = march(ro, rd, hitPos, baseCol);
    if (t < 0.0)                        // background
    {
        FragColor = vec4(0.0);
        return;
    }

    /* ---------- 3) Light ------------------------------------------------ */
    vec3 n = calcNormal(hitPos);
    vec3 viewDir = normalize(-rd);           // 从 hit 点看向相机

    /* 半球环境光（天空 + 地面） */
    vec3 skyCol    = vec3(0.24, 0.32, 0.45);
    vec3 groundCol = vec3(0.18, 0.15, 0.13);
    vec3 hemi      = mix(groundCol, skyCol, n.y * 0.5 + 0.5);  // n.y [-1,1]

    /* 两盏方向光 */
    const vec3 kDir = normalize(vec3( 0.5, 0.7, -0.4));   // 主光
    const vec3 fDir = normalize(vec3(-0.4, 0.3,  0.5));   // 反光
    vec3 lightCol   = vec3(1.0, 0.97, 0.92);

    float kDiff = max(dot(n, kDir), 0.0);
    float fDiff = max(dot(n, fDir), 0.0);

    /* Blinn‑Phong 高光 */
    vec3 halfK = normalize(kDir + viewDir);
    vec3 halfF = normalize(fDir + viewDir);
    float kSpec = pow(max(dot(n, halfK), 0.0), 64.0);
    float fSpec = pow(max(dot(n, halfF), 0.0), 64.0);

    /* 混合：0.6 环境 + 方向光 + 0.4 高光 */
    vec3 color =
        baseCol * (hemi * 0.6 + lightCol * (0.9*kDiff + 0.4*fDiff))
        + lightCol * 0.4 * (kSpec + fSpec);

    color = pow(color, vec3(1.0/2.2));   // sRGB Gamma
    FragColor = vec4(color, 1.0);
}
