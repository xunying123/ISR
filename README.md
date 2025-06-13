# 3D分形渲染系统

本项目使用SDF ray marching技术实现了高质量的3D分形渲染，包括Mandelbulb和Julia Set分形。

## 功能特性

### Mandelbulb分形
- **高质量3D分形**：基于Inigo Quilez经典算法实现
- **可配置参数**：支持调整幂次、迭代次数、缩放等
- **实时渲染**：针对GPU优化的SDF实现
- **材质支持**：支持漫反射、反射、折射等多种材质

### Julia Set分形 (实验性)
- **Orbit Trapping技术**：使用先进的orbit trapping生成3D Julia集合
- **复杂分形结构**：支持各种经典Julia参数
- **高精度距离估计**：确保准确的ray marching

## 使用方法

### 创建Mandelbulb

```cpp
#include "objects.h"

using namespace Objects;
CSG_tree tree = CSG_tree();

// 创建Mandelbulb
auto* mandelbulb = tree.create_mandelbulb(
    {1.0f, 0.3f, 0.8f, 1.0f},        // 颜色 (RGBA)
    glm::vec3(0.0f, 0.8f, 0.0f),     // 中心位置
    2.0f,                             // 缩放系数
    8.0f,                             // 幂次参数 (经典值为8)
    32,                               // 迭代次数
    0,                                // 材质类型
    0.0f                              // 材质参数
);
```

### 参数说明

| 参数 | 类型 | 说明 |
|------|------|------|
| color | `Color` | RGBA颜色值 |
| center | `glm::vec3` | 3D空间中的中心位置 |
| scale | `float` | 缩放系数，控制分型大小 |
| power | `float` | Mandelbulb幂次参数 (推荐2-16) |
| max_iterations | `int` | 最大迭代次数 (推荐16-64) |
| texture | `float` | 材质类型 (0=漫反射, 1=反射, 2=折射) |
| para | `float` | 材质参数 (如折射率) |

### 经典幂次参数

```cpp
// 不同的幂次产生不同的形状：
power = 2.0f;   // 简单的球形结构
power = 4.0f;   // 四重对称结构
power = 6.0f;   // 六重对称结构  
power = 8.0f;   // 经典Mandelbulb (推荐)
power = 12.0f;  // 复杂的高阶结构
```

## 技术实现

### Mandelbulb SDF算法

基于球坐标系的幂次迭代：

```glsl
// z = z^power + c
float r = length(z);
float theta = power * acos(z.y / r);
float phi = power * atan(z.x, z.z);
z = pow(r, power) * vec3(
    sin(theta) * sin(phi),
    cos(theta),
    sin(theta) * cos(phi)
) + c;
```

### 距离估计

使用轨道导数计算精确的距离场：

```glsl
dz = power * pow(sqrt(m), power - 1.0) * dz + 1.0;
distance = 0.25 * log(m) * sqrt(m) / dz * scale;
```

## 性能优化建议

### 1. 迭代次数调整
- **实时预览**：16-32次迭代
- **高质量渲染**：32-64次迭代
- **离线渲染**：64+次迭代

### 2. Ray Marching优化
```glsl
// 在march函数中使用保守步长
t += d * 0.6;  // 适合分形的步长因子
```

### 3. 精度设置
```glsl
const float EPS = 1e-5;  // 分形适用的精度阈值
```

## 编译和运行

```bash
# 编译项目
make

# 运行程序
./ISR
```

## 相机控制

- **位置**：`(0, 2, -5)`
- **俯视角度**：`-20°`
- **目标**：分形中心位置

## 示例场景

项目包含一个完整的示例场景：
- 灰色地面平面
- 紫色Mandelbulb分形
- 环境光照和阴影
- HDR环境贴图

## 扩展功能

### 材质类型
1. **漫反射材质** (texture=0)：标准的Lambert着色
2. **反射材质** (texture=1)：镜面反射效果
3. **折射材质** (texture=2)：透明玻璃效果

### CSG操作
支持与其他几何体进行布尔运算：
- `create_union()` - 并集
- `create_intersection()` - 交集  
- `create_subtract()` - 差集

## 技术参考

- [Inigo Quilez - Mandelbulb](https://iquilezles.org/articles/mandelbulb/)
- [Distance Estimation for 3D Fractals](http://blog.hvidtfeldts.net/index.php/2011/09/distance-estimated-3d-fractals-v-the-mandelbulb-different-de-approximations/)
- [Shadertoy Mandelbulb Examples](https://www.shadertoy.com/results?query=mandelbulb)

## 许可证

本项目基于开源协议，感谢3D分形渲染社区的贡献。
