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
float sdBox(vec3 p, vec3 b)
{
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
/* ——— Capsule（圆柱核心）——— */
float sdCapsule(vec3 p, vec3 a, vec3 b, float r)
{
    vec3 pa = p - a,  ba = b - a;
    float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
    return length(pa - ba*h) - r;
}

/* ——— 圆柱（带平面端盖）——— */
float sdCylinderFlat(vec3 p, vec3 a, vec3 b, float r)
{
    /* 1) 预处理轴向基向量 */
    vec3  ba   = b - a;
    float h2   = length(ba) * 0.5;        // 半高
    vec3  axis = ba / (h2 * 2.0);         // 单位向量
    vec3  mid  = (a + b) * 0.5;           // 圆柱中心

    /* 2) 构造正交基 (x,y 组成横截面平面，z 为轴) */
    vec3 up  = abs(axis.z) < 0.999 ? vec3(0,0,1) : vec3(1,0,0);
    vec3 x   = normalize(cross(up, axis));
    vec3 y   = cross(axis, x);

    /* 3) 把 p 映射到该局部坐标 */
    vec3 lp = vec3(dot(p - mid, x),
                   dot(p - mid, y),
                   dot(p - mid, axis));     // lp.z ∈ [-h2, h2]

    /* 4) 经典 2D SDF 公式 */
    vec2 d = abs(vec2(length(lp.xy), lp.z)) - vec2(r, h2);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}


float distOne(int idx, vec3 p, out vec3 objColor)
{
    const int STRIDE = 8;               // 每个物体 8 × vec4
    int base = idx * STRIDE;  

    vec4 t0 = texelFetch(objectBuffer, base + 0);   // type & RGB
    vec4 t1 = texelFetch(objectBuffer, base + 1);   // A + pos0~2
    vec4 t2 = texelFetch(objectBuffer, base + 2);   // pos3~6
    vec4 t3 = texelFetch(objectBuffer, base + 3);   // pos7~10
    vec4 t4 = texelFetch(objectBuffer, base + 4);

    int  type = int(t0.x + 0.5);
    objColor  = t0.yzw;                 // 颜色 rgb

    if (type == 0)                      /* ---------- SPHERE ---------- */
    {
        vec3 center = t1.yzw;           // (pos0~2)
        float radius = t2.x;            // (pos3)
        return sdSphere(p - center, radius);
    }
    else if (type == 2)               /* ---------- CYLINDER ---------- */
    {
        vec3 a       = t1.yzw;                    // 端点 A
        vec3 b       = t2.xyz;                    // 端点 B
        float radius = t2.w;                      // 半径 (pos3)
        return sdCylinderFlat(p, a, b, radius);
    }
    else if (type == 3)                 /* ---------- CUBOID ---------- */
    {
        vec3 center   = t1.yzw;                     // (pos0~2)
        vec3 halfExt  = vec3(t2.x, t2.y, t2.z) * 0.5; // 长宽高一半
        return sdBox(p - center, halfExt);
    }

    /* TODO：圆锥、圆柱、四面体…… */
    return 1e6;                         // 默认返回“很远”
}

/* ======== 场景距离 + 最近物体颜色 ======== */
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
        if (d < EPS) return t;          // 命中
        t += d;
        if (t > TMAX) break;            // 射线飞出远裁剪
    }
    return -1.0;                        // 未命中
}

/* ======== 主函数 ======== */
void main()
{
    /* 1) 构造相机光线（简单透视） */
    vec2 uv = (fragCoord * 2.0 - 1.0);
    uv.x *= iResolution.x / iResolution.y;

    vec3 ro = vec3(0.0, 0.0, -6.0);     // 相机位置
    vec3 rd = normalize(vec3(uv, 1.5)); // 视线方向

    /* 2) Ray March */
    vec3 hitPos, baseCol;
    float t = march(ro, rd, hitPos, baseCol);
    if (t < 0.0)                        // 没打到任何物体 → 背景
    {
        FragColor = vec4(0.0);
        return;
    }

    /* 3) 光照 (简单 Diffuse) */
    vec3 n = calcNormal(hitPos);
    vec3 lightDir = normalize(vec3(0.0, 0.0, -0.4));
    float diff = max(dot(n, lightDir), 0.0);
    vec3 color = baseCol * diff + 0.25; // 再加一点环境光

    FragColor = vec4(color, 1.0);
}
