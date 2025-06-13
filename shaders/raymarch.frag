#version 430 core
out vec4 FragColor;
in  vec2 fragCoord;

uniform vec2  iResolution;          // 屏幕分辨率

uniform samplerBuffer objectBuffer; // TBO 采样器
uniform int           numObjects;   // 物体数量
uniform samplerCube uEnvMap; 
uniform int         uEnvEnable;

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

float sdTetrahedron( vec3 p, vec3 v0, vec3 v1, vec3 v2, vec3 v3 )
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

float sdMengerSponge(vec3 p, float size, int iterations)
{
    p = p / size;
    
    // 开始时是一个立方体
    float d = sdBox(p, 0.0, 0.0, 0.0, vec3(1.0));
    
    // 基于Inigo Quilez的经典算法
    float s = 1.0;
    for(int m = 0; m < iterations; m++)
    {
        vec3 a = mod(p * s, 2.0) - 1.0;
        s *= 3.0;
        
        // 计算"反向十字"的距离
        vec3 r = abs(1.0 - 3.0 * abs(a));
        
        // 十字形：三个相互垂直的无限长条的并集
        float c1 = sdBox(r, 0.0, 0.0, 0.0, vec3(2.0, 1.0, 1.0)) / s; // X方向
        float c2 = sdBox(r, 0.0, 0.0, 0.0, vec3(1.0, 2.0, 1.0)) / s; // Y方向  
        float c3 = sdBox(r, 0.0, 0.0, 0.0, vec3(1.0, 1.0, 2.0)) / s; // Z方向
        
        float c = min(min(c1, c2), c3);
        
        // 从立方体中减去十字形
        d = max(d, c);
    }
    
    return d * size;
}

// Mandelbulb 3D SDF函数
// 基于Inigo Quilez的实现: https://iquilezles.org/articles/mandelbulb/
float sdMandelbulb(vec3 p, vec3 center, float scale, float power, int maxIter)
{
    vec3 w = (p - center) / scale;
    float m = dot(w, w);
    
    vec4 trap = vec4(abs(w), m);
    float dz = 1.0;
    
    for(int i = 0; i < maxIter; i++)
    {
        // |z|^2 > 4 则逃逸  
        if(m > 4.0) break;
        
        // dz = power*|z|^(power-1)*dz + 1
        dz = power * pow(sqrt(m), power - 1.0) * dz + 1.0;
        
        // z = z^power + c (这里c就是原始位置)
        float r = length(w);
        float b = power * acos(w.y / r);
        float a = power * atan(w.x, w.z);
        w = pow(r, power) * vec3(
            sin(b) * sin(a),
            cos(b),
            sin(b) * cos(a)
        ) + (p - center) / scale;
        
        trap = min(trap, vec4(abs(w), m));
        m = dot(w, w);
    }
    
    // 距离估计
    return 0.25 * log(m) * sqrt(m) / dz * scale;
}

// Julia Set 3D SDF函数 - 基于Orbit Trapping技术
// 参考: https://iquilezles.org/articles/juliasets3d/ 和 https://iquilezles.org/articles/orbittraps3d/
float sdJuliaSet3D(vec3 p, vec3 center, float scale, vec2 c, int maxIter)
{
    vec3 z = (p - center) / scale;
    float m2 = 0.0;
    vec2 t = vec2(1e10);
    
    float dz = 1.0;  // 轨道导数
    
    for(int i = 0; i < maxIter; i++)
    {
        m2 = dot(z, z);
        
        // 逃逸条件
        if(m2 > 4.0) break;
        
        // Orbit trapping - 测试与简单陷阱的距离
        t.x = min(t.x, abs(z.y));                    // 到xz平面的距离
        t.y = min(t.y, length(z.xz - vec2(1.0, 0.0))); // 到点(1,0)的距离
        
        // 计算轨道导数
        dz = 2.0 * sqrt(m2) * dz + 1.0;
        
        // Julia集合迭代：z = z^2 + c
        // 使用四元数形式的平方运算
        float x = z.x, y = z.y, zz = z.z;
        z = vec3(
            x*x - y*y - zz*zz + c.x,
            2.0*x*y + c.y,
            2.0*x*zz
        );
    }
    
    // 距离估计，结合orbit trapping效果
    float d = 0.5 * sqrt(m2) * log(m2) / dz;
    
    // 使用orbit trap来调制距离场
    // 这可以创建更有趣的3D Julia集合结构
    float trap = min(t.x, t.y);
    d = max(d, trap * 0.1);  // 混合距离场和orbit traps
    
    return d * scale;
}

void distOne(int idx, vec3 p, inout vec4 stack[8], inout int stack_top, inout int matIDStack[8], inout float matParStack[8])
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
        float texture = t2.y;
        float para = t2.z;

        stack[stack_top] = vec4(curColor, sdSphere(p - center, radius));
        matIDStack[stack_top]  = int(texture + 0.5);
        matParStack[stack_top] = para;
        stack_top += 1;
    }
    else if (type == 1)               /* ------------ CONE -------------*/
    {
        vec3 center = t1.yzw;           // (pos0~2)
        vec3 vertex = t2.xyz;           // (pos3~5)
        float radius = t2.w;            // (pos6)
        float texture = t3.x;
        float para = t3.y;

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
        matIDStack[stack_top]  = int(texture + 0.5);
        matParStack[stack_top] = para;
        stack_top += 1;
    }
    else if (type == 2)               /* ---------- CYLINDER ---------- */
    {
        vec3 a       = t1.yzw;
        vec3 b       = t2.xyz;
        float radius = t2.w;
        float texture = t3.x;
        float para = t3.y;

        stack[stack_top] = vec4(curColor, sdCylinderFlat(p, a, b, radius));
        matIDStack[stack_top]  = int(texture + 0.5);
        matParStack[stack_top] = para;
        stack_top += 1;
    }
    else if (type == 3)                 /* ---------- CUBOID ---------- */
    {
        vec3 center   = t1.yzw;                     // (pos0~2)
        float alpha = t2.w;                        // (pos6)
        float beta  = t3.x;                        // (pos7)
        float gamma = t3.y;                        // (pos8)
        vec3 halfExt  = vec3(t2.x, t2.y, t2.z) * 0.5;  // (pos3~5)
        float texture = t3.z;
        float para = t3.w;

        stack[stack_top] = vec4(curColor, sdBox(p - center, alpha, beta, gamma, halfExt));
        matIDStack[stack_top]  = int(texture + 0.5);
        matParStack[stack_top] = para;
        stack_top += 1;
    }
    else if (type == 4)                 /* ---------- Tetrahedron ---------- */
    {
        vec3 v0 = t1.yzw;                     // (pos0~2)
        vec3 v1 = t2.xyz;                     // (pos3~5)
        vec3 v2 = vec3(t2.w, t3.x, t3.y); // (pos6~8)
        vec3 v3 = vec3(t3.z, t3.w, t4.x); // (pos9~11)
        float texture = t4.y;
        float para = t4.z;

        stack[stack_top] = vec4(curColor, sdTetrahedron(p, v0, v1, v2, v3));
        matIDStack[stack_top]  = int(texture + 0.5);
        matParStack[stack_top] = para;
        stack_top += 1;
    }
    else if (type == 5)                 /* ---------- Intersect ---------- */
    {
        float sdf1 = stack[stack_top - 2].w;
        float sdf2 = stack[stack_top - 1].w;
        vec3 color1 = stack[stack_top - 2].xyz;
        vec3 color2 = stack[stack_top - 1].xyz;
        int   id1  = matIDStack[stack_top-2];
        int   id2  = matIDStack[stack_top-1];
        float pr1  = matParStack[stack_top-2];
        float pr2  = matParStack[stack_top-1];
        stack_top -= 1;
        float condition = step(sdf1, sdf2);
        stack[stack_top - 1] = mix(vec4(color1, sdf1), vec4(color2, sdf2), condition);
        matIDStack[stack_top-1]  = int( mix(float(id1), float(id2), condition) + 0.5 );
        matParStack[stack_top-1] = mix(pr1, pr2, condition);
    }
    else if (type == 6)                 /* ---------- Union ---------- */
    {
        float sdf1 = stack[stack_top - 2].w;
        float sdf2 = stack[stack_top - 1].w;
        vec3 color1 = stack[stack_top - 2].xyz;
        vec3 color2 = stack[stack_top - 1].xyz;
        int   id1  = matIDStack[stack_top-2];
        int   id2  = matIDStack[stack_top-1];
        float pr1  = matParStack[stack_top-2];
        float pr2  = matParStack[stack_top-1];
        stack_top -= 1;
        float condition = step(sdf1, sdf2);
        stack[stack_top - 1] = mix(vec4(color2, sdf2), vec4(color1, sdf1), condition);
        matIDStack[stack_top-1]  = int( mix(float(id2), float(id1), condition) + 0.5 );
        matParStack[stack_top-1] = mix(pr2, pr1, condition);
    }
    else if (type == 7)                 /* ---------- Subtract ---------- */
    {
        float sdf1 = stack[stack_top - 2].w;
        float sdf2 = stack[stack_top - 1].w;
        vec3 color1 = stack[stack_top - 2].xyz;
        vec3 color2 = stack[stack_top - 1].xyz;
        int   id1  = matIDStack[stack_top-2];
        int   id2  = matIDStack[stack_top-1];
        float pr1  = matParStack[stack_top-2];
        float pr2  = matParStack[stack_top-1];
        stack_top -= 1;
        float condition = step(sdf1, -sdf2);
        stack[stack_top - 1] = mix(vec4(color1, sdf1), vec4(color2, -sdf2), condition);

        matIDStack[stack_top-1]  = int( mix(float(id1), float(id2), condition) + 0.5 );
        matParStack[stack_top-1] = mix(pr1, pr2, condition);
    }
    else if (type == 8)                 /* ---------- PLANE ---------- */
    {
        vec3 n = t1.yzw;
        float h = t2.x;
        float texture = t2.y;
        float para = t2.z;
        stack[stack_top] = vec4(curColor, sdPlane(p, n, h));
        matIDStack[stack_top] = int(texture + 0.5);
        matParStack[stack_top]= para;
        stack_top += 1;
    }
    else if (type == 9)                 /* ---------- MENGER_SPONGE ---------- */
    {
        vec3 center = t1.yzw;           // (pos0~2)
        float size = t2.x;              // (pos3)
        int iterations = int(t2.y + 0.5); // (pos4)
        float texture = t2.z;
        float para = t2.w;
        
        stack[stack_top] = vec4(curColor, sdMengerSponge(p - center, size, iterations));
        matIDStack[stack_top] = int(texture + 0.5);
        matParStack[stack_top]= para;
        stack_top += 1;
    }
    else if (type == 10)                /* ---------- MANDELBULB ---------- */
    {
        vec3 center = t1.yzw;           // (pos0~2) center
        float scale = t2.x;             // (pos3) scale
        float power = t2.y;             // (pos4) Mandelbulb幂次参数
        int maxIter = int(t2.z + 0.5);  // (pos5) 最大迭代次数
        float texture = t2.w;           // (pos6) 材质类型
        float para = t3.x;              // (pos7) 材质参数
        
        stack[stack_top] = vec4(curColor, sdMandelbulb(p, center, scale, power, maxIter));
        matIDStack[stack_top] = int(texture + 0.5);
        matParStack[stack_top] = para;
        stack_top += 1;
    }
    else if (type == 11)                /* ---------- JULIA_SET_3D ---------- */
    {
        vec3 center = t1.yzw;           // (pos0~2) center
        float scale = t2.x;             // (pos3) scale
        vec2 c_param = vec2(t2.y, t2.z); // (pos4~5) Julia参数c = c.x + c.y*i
        int maxIter = int(t2.w + 0.5);  // (pos6) 最大迭代次数
        float texture = t3.x;           // (pos7) 材质类型
        float para = t3.y;              // (pos8) 材质参数
        
        stack[stack_top] = vec4(curColor, sdJuliaSet3D(p, center, scale, c_param, maxIter));
        matIDStack[stack_top] = int(texture + 0.5);
        matParStack[stack_top] = para;
        stack_top += 1;
    }
}

float map(vec3 p, out vec3 col, out int matID, out float matPar)
{
    vec4 stack[8] = vec4[8](vec4(0.0), vec4(0.0), vec4(0.0), vec4(0.0), vec4(0.0), vec4(0.0), vec4(0.0), vec4(0.0));
    int   idStack [8] = int[8](0, 0, 0, 0, 0, 0, 0, 0);
    float parStack[8] = float[8](0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f);
    int stack_top = 0;
    for (int i = 0; i < numObjects; ++i)
    {
        distOne(i, p, stack, stack_top, idStack, parStack);
    }
    col = stack[0].xyz;
    matID  = idStack[0];
    matPar = parStack[0];
    return stack[0].w;
}

vec3 calcNormal(vec3 p)
{
    // 使用更高精度的法向量计算
    const float h = 1e-4;  // 减小步长以提高精度
    vec3 dummy;
    int idDummy;
    float parDummy;
    
    // 使用更精确的中心差分法
    vec3 n = vec3(
        map(p + vec3(h, 0.0, 0.0), dummy, idDummy, parDummy) - map(p - vec3(h, 0.0, 0.0), dummy, idDummy, parDummy),
        map(p + vec3(0.0, h, 0.0), dummy, idDummy, parDummy) - map(p - vec3(0.0, h, 0.0), dummy, idDummy, parDummy),
        map(p + vec3(0.0, 0.0, h), dummy, idDummy, parDummy) - map(p - vec3(0.0, 0.0, h), dummy, idDummy, parDummy)
    );
    return normalize(n);
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
        int   idDummy;
        float parDummy;
        float h   = map(pos, dump, idDummy, parDummy);          // 场景 SDF
        if(h < 5e-5) return 0.0;             // 命中遮挡
        res = min(res, 8.0 * h / t);         // penumbra
        t  += clamp(h, 0.02, 0.25);          // 步长
    }
    return clamp(res, 0.0, 1.0);
}

float calcAO(vec3 p, vec3 n)
{
    float occ = 0.0;          // 累积遮挡量
    float w   = 1.0;          // 当前权重
    const int SAMPLE = 16;     // ★ 可调：5≈实时，8–12 略好，16 离线

    for(int i = 1; i <= SAMPLE; ++i)
    {
        float dist = 0.02 * float(i);     // 采样半径 (线性增长)
        vec3  colDummy;
        int   idDummy;
        float parDummy;
        float d = map(p + n * dist, colDummy, idDummy, parDummy);   // 距离场

        occ += (dist - d) * w;             // d 越小 → 遮挡越重
        w   *= 0.6;                        // 权重递减
    }
    return clamp(1.0 - occ, 0.0, 1.0);     // 1→完全暴露, 0→全遮
}

float march(vec3 ro, vec3 rd, out vec3 pos, out vec3 col, out int matID, out float matPar)
{
    const float EPS  = 8e-5;   // 更高的精度阈值
    const float TMAX = 100.0;
    float t = 0.0;
    
    for (int i = 0; i < 768; ++i)  // 增加最大迭代次数
    {
        pos = ro + rd * t;
        float d = map(pos, col, matID, matPar);
        
        if (d < EPS) return t;
        
        // 对于分形结构，使用更保守的步长
        t += d * 0.8;  // 减小步长因子，提高精度
        
        if (t > TMAX) break;
    }
    return -1.0;
}

/* ------------------------------------------------------------
 * diffuseShading
 *   pos      ─ 命中的世界坐标
 *   n        ─ 法向量（已归一化）
 *   viewDir  ─ 从表面指向相机的向量 (已归一化)
 *   albedo   ─ 物体基色 (可以是贴图 × 颜色，也可以纯 solid color)
 *
 * 返回值     ─ 线性色空间 (RGB 0–1)
 * ----------------------------------------------------------*/
vec3 diffuseShading(vec3 pos, vec3 n, vec3 viewDir, vec3 albedo)
{
    /* === 半球环境光 (Hemisphere Ambient) === */
    vec3 skyCol    = vec3(0.24, 0.32, 0.45);   // 天空色
    vec3 groundCol = vec3(0.18, 0.15, 0.13);   // 地面色
    vec3 hemi      = mix(groundCol, skyCol, n.y * 0.5 + 0.5);

    /* === 两盏方向光 === */
    vec3 kDir  = normalize(vec3( 0.5, 0.7, -0.4));  // 关键光 (Key)
    vec3 fDir  = normalize(vec3(-0.4, 0.3,  0.5));  // 反向填充 (Fill/Rim)
    vec3 lightCol = vec3(1.08, 0.97, 0.90);

    /* 主光软阴影 */
    float kShadow = softShadow(pos + n * 1e-3, kDir, 0.05, 20.0);

    /* === 漫反射 (Lambert) === */
    float kDiff = max(dot(n, kDir), 0.0) * kShadow;
    float fDiff = max(dot(n, fDir), 0.0);            // 填充光不投影

    /* === 高光 (Blinn–Phong) === */
    vec3  halfK = normalize(kDir + viewDir);
    vec3  halfF = normalize(fDir + viewDir);
    float kSpec = pow(max(dot(n, halfK), 0.0), 64.0) * kShadow;
    float fSpec = pow(max(dot(n, halfF), 0.0), 64.0);

    /* === 环境光遮蔽 (Ambient Occlusion) === */
    float ao = calcAO(pos, n);

    /* === 颜色合成 === */
    vec3 color =
          albedo * (hemi * 0.6 * ao                     // 环境光
                  + lightCol * (0.9 * kDiff + 0.4 * fDiff))   // 漫反射
        + lightCol * 0.4 * (kSpec + fSpec);                    // 高光

    return color;   // 线性色彩，留给 Tone Mapping 处理
}

void main()
{
    // 抗锯齿开关：设为1启用2x2超采样，设为0禁用以提高性能
    const bool ENABLE_AA = true;
    const int MAX_BOUNCES = 4; // 最大反射次数
    
    vec3 finalColor = vec3(0.0);
    int samples = ENABLE_AA ? 4 : 1;
    
    for(int sampleIdx = 0; sampleIdx < samples; sampleIdx++)
    {
        vec2 sampleCoord = fragCoord;
        
        if(ENABLE_AA)
        {
            int x = sampleIdx % 2;
            int y = sampleIdx / 2;
            vec2 offset = vec2(float(x), float(y)) * 0.5 - 0.25;
            sampleCoord = fragCoord + offset / iResolution.xy;
        }
        
        /* 1) 初始化光线 */
        vec2 uv = (sampleCoord * 2.0 - 1.0);
        uv.x *= iResolution.x / iResolution.y;

        vec3 ro = vec3(0.0, 4.0, -6.0);    // 相机位置：更远的距离以观察分布更开的三个分形
        vec3 rd = normalize(vec3(uv, 1.0)); // ray dir
        float pitch = radians(-15.0);        // 俯视角度减小到15°
        rd.yz = mat2(cos(pitch), -sin(pitch), sin(pitch),  cos(pitch)) * rd.yz;

        /* 2) 光线追踪循环 */
        vec3 accumColor = vec3(0.0);  // 累积颜色
        vec3 throughput = vec3(1.0);  // 光线能量衰减系数
        int bounceCount = 0;           // 当前反射次数
        
        // 光线追踪主循环
        for(int bounce = 0; bounce < MAX_BOUNCES; bounce++)
        {
            bounceCount++;
            
            /* 光线步进 */
            vec3 hitPos, baseCol;
            int   hitMat;
            float hitPar;
            
            float t = march(ro, rd, hitPos, baseCol, hitMat, hitPar);
            
            /* 未命中 - 使用环境贴图 */
            if(t < 0.0)
            {
                vec3 env = (uEnvEnable == 1) ? textureLod(uEnvMap, rd, 0.0).rgb : vec3(0.0);
                accumColor += throughput * env;
                break;
            }
            
            /* 命中表面 - 计算法线 */
            vec3 n = calcNormal(hitPos);
            vec3 viewDir = normalize(-rd);  // 从表面看向相机
            
            /* 3) 材质处理 */
            if(hitMat == 0) // 漫反射材质
            {
                vec3 color = diffuseShading(hitPos, n, viewDir, baseCol);
                accumColor += throughput * color;
                break; // 漫反射不继续反射
            }
            else if(hitMat == 1) // 镜面反射
            {
                // 计算反射方向
                rd = reflect(rd, n);
                
                // 更新光线起点（防止自交）
                ro = hitPos + n * 1e-3;
                
                // 更新能量衰减（反射损失）
                throughput *= baseCol * 0.8;
            }
            else if(hitMat == 2) // 折射材质
            {
                vec3 n = calcNormal(hitPos);
                bool  into = dot(rd, n) < 0.0;
                float n1 = 1.0, n2 = hitPar;
                float eta = into ? n1/n2 : n2/n1;

                float cosI = clamp(dot(-rd, n), 0.0, 1.0);
                float F0   = pow((n1 - n2)/(n1 + n2), 2.0);
                float Fr   = F0 + (1.0 - F0)*pow(1.0 - cosI, 5.0);

                vec3 reflDir = reflect(rd, n);
                vec3 refrDir = refract(rd, into ? n : -n, eta);

                /* 反射颜色 */
                vec3 cRefl; int idD; float pD;
                float tRefl = march(hitPos + n*1e-3, reflDir,
                                    hitPos, cRefl, idD, pD);
                vec3 reflCol = (tRefl < 0.0)
                            ? textureLod(uEnvMap, reflDir, 0.0).rgb
                            : cRefl;

                /* 折射颜色（这里只直接天空盒，也可再 march 一次） */
                vec3 refrCol = textureLod(uEnvMap, refrDir, 0.0).rgb;

                /* Fresnel 线性混合并累加 */
                accumColor += throughput * mix(refrCol, reflCol, Fr);

                /* 终止这条路径 */
                break;
            }
            
            /* 4) 能量衰减检查 - 提前终止 */
            float maxComponent = max(max(throughput.r, throughput.g), throughput.b);
            if(maxComponent < 0.01) break;
        }
        
        /* 5) 色调映射和伽马校正 */
        float exposure = 0.9;
        vec3 mappedColor = accumColor * exposure;
        
        // ACES 色调映射
        mappedColor = (mappedColor * (2.51 * mappedColor + 0.03)) / 
                     (mappedColor * (2.43 * mappedColor + 0.59) + 0.14);
        
        // 提升饱和度
        float sat = 1.5;
        float Y = dot(mappedColor, vec3(0.2126, 0.7152, 0.0722));
        mappedColor = mix(vec3(Y), mappedColor, sat);
        
        // 伽马校正
        mappedColor = pow(mappedColor, vec3(1.0/2.2));
        
        finalColor += mappedColor;
    }
    
    FragColor = vec4(finalColor / float(samples), 1.0);
}