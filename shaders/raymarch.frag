#version 430 core
out vec4 FragColor;
in  vec2 fragCoord;

uniform vec2  iResolution;          // 屏幕分辨率
uniform float iTime;                // 时间（可做动画）

uniform samplerBuffer objectBuffer; // TBO 采样器
uniform int           numObjects;   // 物体数量

const int MAX_POINT = 8;                 // 需要几盏调几盏
uniform int  uPointCnt;                  // 实际使用数量
uniform vec3 uPointPos[MAX_POINT];       // 位置
uniform vec3 uPointCol[MAX_POINT];       // 颜色(含强度，1=白灯)

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
    
    float s = sign(dot(pa, nor));
    
    float sqDist = min(min(
        sqrLength(pa - ba * clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0)),
        sqrLength(pb - cb * clamp(dot(pb, cb)/dot(cb, cb), 0.0, 1.0))),
        sqrLength(pc - ac * clamp(dot(pc, ac)/dot(ac, ac), 0.0, 1.0)))
    + (dot(nor, pa) * dot(nor, pa)) / dot(nor, nor);
    
    return s * sqrt(sqDist);
}

float sdTetrahedron( vec3 p,
                     vec3 v0, vec3 v1,
                     vec3 v2, vec3 v3 )
{
    vec3 verts[4] = vec3[]( v0, v1, v2, v3 );
    int faces[4][3] = int[4][3](
      int[3](0,1,2),  
      int[3](0,2,3),  
      int[3](0,3,1),  
      int[3](1,3,2)   
    );

    vec3 cen = (v0 + v1 + v2 + v3) * 0.25;

    float dMax = -1e20;
    for(int i = 0; i < 4; ++i)
    {
        vec3 a = verts[faces[i][0]];
        vec3 b = verts[faces[i][1]];
        vec3 c = verts[faces[i][2]];

        vec3 n = normalize( cross( b - a, c - a ) );
        if( dot(cen - a, n) > 0.0 ) 
            n = -n;

        float d = dot( p - a, n );
        dMax = max(dMax, d);
    }

    return dMax;
}

float sdPlane(vec3 p, vec3 n, float h)
{
    return dot(p, n) + h;  
}


void distOne(int idx, vec3 p, inout vec4 stack[3], inout int stack_top)
{
    const int STRIDE = 8;               // 8 × vec4
    int base = idx * STRIDE;

    vec4 t0 = texelFetch(objectBuffer, base + 0);   // type & RGB
    vec4 t1 = texelFetch(objectBuffer, base + 1);   // A + pos0~2
    vec4 t2 = texelFetch(objectBuffer, base + 2);   // pos3~6
    vec4 t3 = texelFetch(objectBuffer, base + 3);   // pos7~10
    vec4 t4 = texelFetch(objectBuffer, base + 4);

    int  type = int(t0.x + 0.5);
    vec3 curColor  = t0.yzw;                 // rgb

    if (type == 0)                      /* ---------- SPHERE ---------- */
    {
        vec3 center = t1.yzw;           // (pos0~2)
        float radius = t2.x;            // (pos3)

        stack[stack_top] = vec4(curColor, sdSphere(p - center, radius));
        stack_top += 1;
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

        stack[stack_top] = vec4(curColor, sdCone(p_local, c, height));
        stack_top += 1;
    }
    else if (type == 2)               /* ---------- CYLINDER ---------- */
    {
        vec3 a       = t1.yzw;
        vec3 b       = t2.xyz;
        float radius = t2.w;

        stack[stack_top] = vec4(curColor, sdCylinderFlat(p, a, b, radius));
        stack_top += 1;
    }
    else if (type == 3)                 /* ---------- CUBOID ---------- */
    {
        vec3 center   = t1.yzw;                     // (pos0~2)
        float alpha = t2.w;                        // (pos6)
        float beta  = t3.x;                        // (pos7)
        float gamma = t3.y;                        // (pos8)
        vec3 halfExt  = vec3(t2.x, t2.y, t2.z) * 0.5;  // (pos3~5)

        stack[stack_top] = vec4(curColor, sdBox(p - center, alpha, beta, gamma, halfExt));
        stack_top += 1;
    }
    else if (type == 4)                 /* ---------- Tetrahedron ---------- */
    {
        vec3 v0 = t1.yzw;                     // (pos0~2)
        vec3 v1 = t2.xyz;                     // (pos3~5)
        vec3 v2 = vec3(t2.w, t3.x, t3.y); // (pos6~8)
        vec3 v3 = vec3(t3.z, t3.w, t4.x); // (pos9~11)

        stack[stack_top] = vec4(curColor, sdTetrahedron(p, v0, v1, v2, v3));
        stack_top += 1;
    }
    else if (type == 5)                 /* ---------- Intersect ---------- */
    {
        float sdf1 = stack[stack_top - 2].w;
        float sdf2 = stack[stack_top - 1].w;
        vec3 color1 = stack[stack_top - 2].xyz;
        vec3 color2 = stack[stack_top - 1].xyz;
        stack_top -= 1;
        float condition = step(sdf1, sdf2);
        stack[stack_top - 1] = mix(vec4(color1, sdf1), vec4(color2, sdf2), condition);
    }
    else if (type == 6)                 /* ---------- Union ---------- */
    {
        float sdf1 = stack[stack_top - 2].w;
        float sdf2 = stack[stack_top - 1].w;
        vec3 color1 = stack[stack_top - 2].xyz;
        vec3 color2 = stack[stack_top - 1].xyz;
        stack_top -= 1;
        float condition = step(sdf1, sdf2);
        stack[stack_top - 1] = mix(vec4(color2, sdf2), vec4(color1, sdf1), condition);
    }
    else if (type == 7)                 /* ---------- Subtract ---------- */
    {
        float sdf1 = stack[stack_top - 2].w;
        float sdf2 = stack[stack_top - 1].w;
        vec3 color1 = stack[stack_top - 2].xyz;
        vec3 color2 = stack[stack_top - 1].xyz;
        stack_top -= 1;
        float condition = step(sdf1, -sdf2);
        stack[stack_top - 1] = mix(vec4(color1, sdf1), vec4(color2, -sdf2), condition);
    }
    else if (type == 8)                 /* ---------- PLANE ---------- */
    {
        vec3 n = t1.yzw;
        float h = t2.x;
        stack[stack_top] = vec4(curColor, sdPlane(p, n, h));
        stack_top += 1;
    }
}

float map(vec3 p, out vec3 col)
{
    vec4 stack[3] = vec4[3](vec4(0.0), vec4(0.0), vec4(0.0));
    int stack_top = 0;
    for (int i = 0; i < numObjects; ++i)
    {
        distOne(i, p, stack, stack_top);
    }
    col = stack[0].xyz;
    return stack[0].w;
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

/* === Soft Shadow (directional) === */
float softShadow(vec3 ro, vec3 rd, float mint, float maxt)
{
    float res = 1.0;
    float t   = mint;
    for(int i = 0; i < 128 && t < maxt; ++i)   // 步数可 32~128
    {
        vec3  pos = ro + rd * t;
        vec3  dump;
        float h   = map(pos, dump);          // 场景 SDF
        if(h < 5e-5) return 0.0;             // 命中遮挡
        res = min(res, 6.0 * h / t);         // penumbra
        t  += clamp(h, 0.02, 0.25);          // 步长
    }
    return clamp(res, 0.0, 1.0);
}

/* ============================================================
   点光 Soft Shadow  (ro, rd, distMax)
   ============================================================ */
float softShadowPoint(vec3 ro, vec3 rd, float distMax)
{
    float res = 1.0;
    float t   = 0.05;                         // 起始步
    for(int i = 0; i < 128 && t < distMax; ++i)
    {
        vec3  pos = ro + rd * t;
        vec3  dump;
        float h   = map(pos, dump);
        if(h < 5e-5) return 0.0;
        res = min(res, 5.0 * h / t);
        t  += clamp(h, 0.02, 0.20);
    }
    return clamp(res, 0.0, 1.0);
}


float calcAO(vec3 p, vec3 n)
{
    float occ = 0.0;          // 累积遮挡量
    float w   = 1.0;          // 当前权重
    const int SAMPLE = 8;     // ★ 可调：5≈实时，8–12 略好，16 离线

    for(int i = 1; i <= SAMPLE; ++i)
    {
        float dist = 0.03 * float(i);     // 采样半径 (线性增长)
        vec3  colDummy;
        float d = map(p + n * dist, colDummy);   // 距离场

        occ += (dist - d) * w;             // d 越小 → 遮挡越重
        w   *= 0.8;                        // 权重递减
    }
    return clamp(1.0 - occ, 0.0, 1.0);     // 1→完全暴露, 0→全遮
}


float march(vec3 ro, vec3 rd, out vec3 pos, out vec3 col)
{
    const float EPS  = 1e-4;
    const float TMAX = 100.0;
    float t = 0.0;
    for (int i = 0; i < 256; ++i)
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
    vec3 n       = calcNormal(hitPos);
    vec3 viewDir = normalize(-rd);            // 从表面看向相机

    /* === 环境光遮蔽 (AO) === */
    float ao = calcAO(hitPos, n);

    /* === 半球环境光 (天空+地面) === */
    vec3 skyCol    = vec3(0.24, 0.32, 0.45);
    vec3 groundCol = vec3(0.18, 0.15, 0.13);
    vec3 hemi      = mix(groundCol, skyCol, n.y * 0.5 + 0.5);

    /* === 两盏方向光 === */
    const vec3 kDir = normalize(vec3( 0.5, 0.7, -0.4));    // 主光
    const vec3 fDir = normalize(vec3(-0.4, 0.3,  0.5));    // 反光
    vec3  lightCol  = vec3(1.15, 0.97, 0.85);

    /* 主光软阴影 */
    float kShadow = softShadow(hitPos + n*1e-3, kDir, 0.05, 20.0);

    /* 漫反射 */
    float kDiff = max(dot(n, kDir), 0.0) * kShadow;
    float fDiff = max(dot(n, fDir), 0.0);                  // 反光不投影

    /* 高光（Blinn-Phong） */
    vec3  halfK = normalize(kDir + viewDir);
    vec3  halfF = normalize(fDir + viewDir);
    float kSpec = pow(max(dot(n, halfK), 0.0), 64.0) * kShadow;
    float fSpec = pow(max(dot(n, halfF), 0.0), 64.0);

    /* ========== 基色累加 ========== */
    vec3 color =
        baseCol * (hemi * 0.6 * ao                       // 环境光 × AO
                + lightCol * (0.9*kDiff + 0.4*fDiff))   // 两盏方向光漫反射
        + lightCol * 0.4 * (kSpec + fSpec);                // 高光

    /* ---------- 点光循环 ---------- */
    for(int i = 0; i < uPointCnt; ++i)
    {
        vec3  L    = uPointPos[i] - hitPos;
        float dist = length(L);
        L /= dist;

        /* 衰减 & 阴影 */
        float atten  = 1.0 / (1.0 + 0.09*dist + 0.032*dist*dist);
        float shadow = softShadowPoint(hitPos + n*1e-3, L, dist);

        /* 漫反射 + 高光 */
        float diff = max(dot(n, L), 0.0);
        vec3 halfP = normalize(L + viewDir);
        float spec = pow(max(dot(n, halfP), 0.0), 64.0);

        vec3 light = uPointCol[i] * atten * shadow;
        color += light * (baseCol * diff + spec);
    }

    /* ---------- HDR ToneMap (ACES) + Gamma ---------- */
    float exposure = 1.0;                                   // 可调曝光
    color *= exposure;

    color = (color * (2.51*color + 0.03)) /                 // ACES 近似
            (color * (2.43*color + 0.59) + 0.14);

    color = pow(color, vec3(1.0/2.2));                      // sRGB Gamma
    FragColor = vec4(color, 1.0);
}