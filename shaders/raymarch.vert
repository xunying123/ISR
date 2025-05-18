#version 430 core
// ---------- 顶点属性 ----------
layout (location = 0) in vec2 aPos;   // 来自 VBO 的二维顶点坐标（范围 −1..1）

// ---------- 传递给片段着色器 ----------
out vec2 fragCoord;                   // 归一化屏幕坐标 0..1

void main()
{
    // 把 [-1,1] 线性映射到 [0,1]，方便片段着色器直接使用
    fragCoord   = aPos * 0.5 + 0.5;

    // 最终裁剪空间坐标，z 设为 0，w 设为 1
    gl_Position = vec4(aPos, 0.0, 1.0);
}
