#version 330 core
out vec4 FragColor;
in vec2 fragCoord;
uniform vec2 iResolution;
uniform float iTime;

int materialID = 0;

float sdfSphere(vec3 p, float r) {
    return length(p) - r;
}

float sdfBox(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}

float map(vec3 p) {
    float d1 = sdfSphere(p - vec3(-1.5, 0.0, 3.0), 1.0);
    float d2 = sdfBox(p - vec3(1.5, 0.0, 3.0), vec3(0.7));
    float minD = d1;
    materialID = 1;
    if (d2 < minD) { minD = d2; materialID = 2; }
    return minD;
}

vec3 estimateNormal(vec3 p) {
    float h = 0.001;
    return normalize(vec3(
        map(p + vec3(h, 0, 0)) - map(p - vec3(h, 0, 0)),
        map(p + vec3(0, h, 0)) - map(p - vec3(0, h, 0)),
        map(p + vec3(0, 0, h)) - map(p - vec3(0, 0, h))
    ));
}

float rayMarch(vec3 ro, vec3 rd) {
    float t = 0.0;
    for (int i = 0; i < 100; i++) {
        vec3 p = ro + t * rd;
        float d = map(p);
        if (d < 0.001) return t;
        t += d;
        if (t > 100.0) break;
    }
    materialID = 0;
    return -1.0;
}

void main() {
    vec2 uv = fragCoord * 0.5 + 0.5;
    uv = uv * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    vec3 ro = vec3(0.0, 0.0, -5.0);
    vec3 rd = normalize(vec3(uv, 1.0));

    float t = rayMarch(ro, rd);
    if (t > 0.0) {
        vec3 p = ro + t * rd;
        vec3 n = estimateNormal(p);
        vec3 lightDir = normalize(vec3(1.0, 1.0, -1.0));
        float diff = max(dot(n, lightDir), 0.0);
        vec3 color = (materialID == 1) ? vec3(1, 0.3, 0.3) : vec3(0.3, 0.3, 1.0);
        FragColor = vec4(color * diff, 1.0);
    } else {
        FragColor = vec4(0.0);
    }
}
