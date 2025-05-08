#version 330 core

out vec4 FragColor;
in vec2 fragCoord;

uniform vec2 iResolution;
uniform float iTime;

// 距离函数（SDF）：单位球体
float sdfSphere(vec3 p, float r) {
    return length(p) - r;
}

// 场景中的物体
float map(vec3 p) {
    return sdfSphere(p - vec3(0.0, 0.0, 3.0), 1.0);
}

// 法线估计
vec3 getNormal(vec3 p) {
    float h = 0.001;
    vec2 k = vec2(1, -1);
    return normalize(
        k.xyy * map(p + k.xyy * h) +
        k.yyx * map(p + k.yyx * h) +
        k.yxy * map(p + k.yxy * h) +
        k.xxx * map(p + k.xxx * h)
    );
}

// 光线步进
float rayMarch(vec3 ro, vec3 rd) {
    float t = 0.0;
    for (int i = 0; i < 100; i++) {
        vec3 p = ro + t * rd;
        float d = map(p);
        if (d < 0.001) return t;
        t += d;
        if (t > 100.0) break;
    }
    return -1.0;
}

void main() {
    // 将屏幕坐标归一化为 [-1, 1]
    vec2 uv = (fragCoord / iResolution) * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    vec3 ro = vec3(0.0, 0.0, -5.0);          // 相机位置
    vec3 rd = normalize(vec3(uv, 1.0));      // 光线方向

    float t = rayMarch(ro, rd);
    if (t > 0.0) {
        vec3 p = ro + rd * t;
        vec3 n = getNormal(p);
        vec3 lightDir = normalize(vec3(1.0, 1.0, -1.0));
        float diff = max(dot(n, lightDir), 0.0);
        FragColor = vec4(vec3(diff), 1.0);
    } else {
        FragColor = vec4(0.0);
    }
}
