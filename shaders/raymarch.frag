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

float distOne(int idx, vec3 p, out vec3 objColor)
{
    const int STRIDE = 8;               // 每个物体 8 × vec4
    int base = idx * STRIDE;  

    vec4 t0 = texelFetch(objectBuffer, base + 0);   // type & RGB
    vec4 t1 = texelFetch(objectBuffer, base + 1);   // A + pos0~2
    vec4 t2 = texelFetch(objectBuffer, base + 2);   // pos3~6
    vec4 t3 = texelFetch(objectBuffer, base + 3);   // pos7~10

    int  type = int(t0.x + 0.5);
    objColor  = t0.yzw;                 // 颜色 rgb

    if (type == 0)                      /* ---------- SPHERE ---------- */
    {
        vec3 center = t1.yzw;           // (pos0~2)
        float radius = t2.x;            // (pos3)
        return sdSphere(p - center, radius);
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
