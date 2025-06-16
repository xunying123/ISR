# Implicit Surface Rendering

基于OpenGL的实时隐式曲面渲染系统，使用Signed Distance Field (SDF)和Ray Marching技术实现高质量的3D几何体和分形渲染。

## 功能特性

### 基础几何体
- **球体 (Sphere)**：标准球形SDF
- **立方体 (Cuboid)**：可旋转的长方体
- **圆柱体 (Cylinder)**：任意方向的圆柱
- **圆锥体 (Cone)**：锥形几何体
- **四面体 (Tetrahedron)**：四面体结构
- **平面 (Plane)**：无限平面

### 分形几何体
- **Mandelbulb**：经典3D分形结构
- **Julia Set 3D**：四元数扩展的Julia集合  
- **Menger Sponge**：门格海绵分形

### CSG布尔运算
- **并集 (Union)**：多个对象合并
- **交集 (Intersection)**：对象相交部分
- **差集 (Difference)**：对象相减

### 渲染特性
- **实时Ray Marching**：GPU加速的高性能渲染
- **多种材质**：漫反射、反射、折射材质
- **软阴影**：基于SDF的软阴影算法
- **环境光遮蔽**：增强视觉深度感
- **HDR环境光照**：基于物理的光照模型

## 快速开始

### 编译

```bash
mkdir build && cd build
cmake ..
make
```

### 运行

```bash
./ISR
```

## 基本用法

### 创建基础几何体

```cpp
#include "objects.h"

using namespace Objects;
CSG_tree tree;

// 创建球体
auto* sphere = tree.create_sphere(
    {1.0f, 0.0f, 0.0f, 1.0f},    // 红色
    glm::vec3(0, 0, 0),          // 中心位置
    1.0f                         // 半径
);

// 创建立方体
auto* cube = tree.create_cuboid(
    {0.0f, 1.0f, 0.0f, 1.0f},    // 绿色
    glm::vec3(2, 0, 0),          // 位置
    1.0f, 1.0f, 1.0f,            // 长宽高
    0.0f, 0.0f, 0.0f             // 旋转角度
);

// 创建圆柱体
auto* cylinder = tree.create_cylinder(
    {0.0f, 0.0f, 1.0f, 1.0f},    // 蓝色
    glm::vec3(0, -1, 0),         // 底部中心
    glm::vec3(0, 1, 0),          // 顶部中心
    0.5f                         // 半径
);
```

### 创建分形几何体

```cpp
// 创建Mandelbulb分形
auto* mandelbulb = tree.create_mandelbulb(
    {1.0f, 0.8f, 0.3f, 1.0f},    // 橙色
    glm::vec3(0, 1, 0),          // 位置
    2.0f,                        // 大小
    8.0f,                        // 幂次
    32                           // 迭代数
);

// 创建Julia Set
auto* julia = tree.create_julia_set_3d(
    {0.8f, 0.3f, 1.0f, 1.0f},    // 紫色
    glm::vec3(0, 0, 0),          // 位置  
    1.5f,                        // 大小
    glm::vec2(-0.4f, 0.6f),      // Julia参数
    64                           // 迭代数
);

// 创建Menger海绵
auto* menger = tree.create_menger_sponge(
    {1.0f, 1.0f, 0.0f, 1.0f},    // 黄色
    glm::vec3(-2, 0, 0),         // 位置
    1.0f,                        // 大小
    3                            // 迭代层数
);
```

### CSG布尔运算

```cpp
// 创建两个球体
auto* sphere1 = tree.create_sphere({1,0,0,1}, glm::vec3(-0.5,0,0), 1.0f);
auto* sphere2 = tree.create_sphere({0,1,0,1}, glm::vec3(0.5,0,0), 1.0f);

// 并集操作
auto* union_obj = tree.create_union({1,1,1,1}, sphere1, sphere2);

// 交集操作  
auto* intersect_obj = tree.create_intersection({1,0,1,1}, sphere1, sphere2);

// 差集操作
auto* diff_obj = tree.create_difference({0,1,1,1}, sphere1, sphere2);
```

### 对象变换

```cpp
// 平移
sphere->translate(glm::vec3(1.0f, 0.0f, 0.0f));

// 缩放
sphere->scale(2.0f);

// 旋转 (绕Y轴旋转45度)
sphere->rotate(glm::vec3(0, 1, 0), glm::radians(45.0f));
```

## 材质系统

```cpp
// 材质类型参数
float texture = 0;  // 0=漫反射, 1=反射, 2=折射
float para = 0.0f;  // 材质参数 (如折射率)

// 漫反射材质
auto* diffuse = tree.create_sphere({1,0,0,1}, glm::vec3(0,0,0), 1.0f, 0, 0.0f);

// 反射材质
auto* mirror = tree.create_sphere({1,1,1,1}, glm::vec3(2,0,0), 1.0f, 1, 0.0f);

// 折射材质 (玻璃)
auto* glass = tree.create_sphere({1,1,1,0.8f}, glm::vec3(-2,0,0), 1.0f, 2, 1.5f);
```

## 依赖库

- **OpenGL 3.3+**：图形渲染API
- **GLFW 3.4**：窗口管理和输入处理
- **GLM**：数学库 (向量、矩阵运算)
- **GLAD**：OpenGL函数加载器
- **STB Image**：HDR纹理加载

## 控制方式

- **鼠标移动**：旋转相机视角
- **WASD键**：移动相机位置
- **鼠标滚轮**：缩放视野
- **ESC键**：退出程序

## 技术特点

### SDF距离场
- **精确几何表示**：数学函数定义的完美几何体
- **无限细节**：不受多边形分辨率限制
- **平滑布尔运算**：自然的几何体合并

### Ray Marching算法
- **自适应步长**：根据距离场动态调整步长
- **高效求交**：避免传统光线追踪的复杂计算
- **软阴影支持**：利用距离场特性实现软阴影

### 分形渲染优化
- **距离估计**：专用的分形距离估计算法
- **迭代控制**：可调节的迭代次数和精度
- **轨道捕获**：Julia集合的高级着色技术

### 光照模型
- **Blinn-Phong着色**：经典的光照模型
- **环境光遮蔽**：增强几何体的立体感
- **HDR环境贴图**：真实的环境反射
- **ACES色调映射**：电影级的色彩处理

## 项目结构

```
ISR/
├── src/                    # 主程序源码
│   ├── main.cpp           # 程序入口和渲染循环
│   ├── glad.c             # OpenGL函数加载
│   └── stb_image.h        # 图像加载库
├── dev/                    # 对象系统
│   ├── objects.h          # 对象类定义
│   └── objects.cpp        # 对象实现
├── shaders/               # GLSL着色器
│   ├── raymarch.vert      # 顶点着色器
│   ├── raymarch.frag      # 片段着色器 (主要渲染逻辑)
│   └── glacier.hdr        # HDR环境贴图
├── glfw-3.4/              # GLFW窗口库
├── glad/                  # GLAD OpenGL加载器
├── CMakeLists.txt         # CMake构建配置
└── README.md              # 项目说明
```

## 性能优化

### 渲染优化
- **早期退出**：超出最大步数时提前终止
- **精度控制**：可调节的表面检测精度
- **视锥剔除**：只渲染可见区域

### 分形优化
- **迭代限制**：合理设置最大迭代次数
- **逃逸半径**：提前终止发散的轨道
- **距离缓存**：重用计算结果

## 扩展功能

### 高级几何体
- 支持添加更多SDF基元 (环面、椭球等)
- 自定义SDF函数
- 程序化几何生成

### 渲染效果
- 体积渲染支持
- 次表面散射
- 景深效果
- 运动模糊

### 交互功能
- 实时参数调节
- 场景编辑器
- 动画系统

## 学术应用

本项目适用于：
- **计算机图形学**：SDF和Ray Marching技术研究
- **分形几何**：3D分形可视化和分析
- **数值计算**：距离估计算法优化
- **GPU编程**：并行计算和着色器开发

## 许可证

开源项目，基于MIT许可证。欢迎贡献代码、报告问题和提出改进建议。

---

*本项目展示了现代GPU上隐式曲面渲染的强大能力，结合了经典的计算几何理论与实时图形渲染技术。*
