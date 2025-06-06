# ISR - Ray Marching 渲染器

## 概述
这是一个基于ray marching技术和有符号距离场(SDF)的实时渲染器，支持渲染各种几何体和分形物体。

## 新增功能：Menger Sponge（门格尔海绵）

### 什么是Menger Sponge？
Menger Sponge是一种著名的分形几何体，由德国数学家Karl Menger于1926年提出。它通过递归地从立方体中移除十字形区域来构建，具有无限复杂的表面结构。

### 实现特点
- **精确的SDF函数**：实现了准确的Menger sponge有符号距离场函数
- **可调迭代次数**：支持0-5次迭代，展示不同的分形复杂度
- **实时渲染**：基于GPU的ray marching技术，实现实时渲染
- **完整变换支持**：支持平移、旋转、缩放等变换操作

### 使用方法

#### 创建Menger Sponge对象
```cpp
// 基本语法
auto* menger = tree.create_menger_sponge(
    {r, g, b, a},           // 颜色 (RGBA)
    glm::vec3(x, y, z),     // 中心位置
    size,                   // 大小
    iterations              // 迭代次数 (0-5)
);

// 示例：创建一个橙色的3次迭代Menger sponge
auto* menger = tree.create_menger_sponge(
    {0.8f, 0.4f, 0.2f, 1.0f},      // 橙色
    glm::vec3(0.0f, 1.0f, 0.0f),   // 位置
    2.0f,                           // 大小
    3                               // 3次迭代
);
```

#### 应用变换
```cpp
// 平移
menger->translate(glm::vec3(1.0f, 0.0f, 0.0f));

// 缩放
menger->scale(1.5f);

// 旋转（绕轴旋转）
menger->rotate(glm::vec3(0.0f, 1.0f, 0.0f), glm::radians(45.0f));
```

#### 与其他物体进行CSG操作
```cpp
auto* sphere = tree.create_sphere({1.0f, 0.0f, 0.0f, 1.0f}, 
                                  glm::vec3(0.0f), 1.0f);
auto* intersection = tree.create_intersection(menger, sphere);
auto* union_obj = tree.create_union(menger, sphere);
auto* difference = tree.create_subtract(menger, sphere);
```

### 迭代次数效果
- **0次迭代**：普通立方体
- **1次迭代**：6个面各有一个十字形孔洞
- **2次迭代**：更小的十字形孔洞开始出现
- **3次迭代**：明显的分形结构
- **4次迭代**：复杂的海绵状结构
- **5次迭代**：极其复杂的分形细节

### 性能提示
- 较高的迭代次数会增加渲染开销
- 建议在实时应用中使用3次以下迭代
- 可以通过调整ray marching步长来平衡质量和性能

## 构建和运行

### 构建项目
```bash
make
```

### 运行程序
```bash
./ISR
```

## 技术细节

### SDF函数实现
Menger sponge的SDF函数基于Inigo Quilez的经典算法：
1. 从基础立方体开始
2. 每次迭代将空间按3倍缩放并折叠
3. 计算反向十字形的距离场
4. 使用max操作从立方体中减去十字形区域

这个实现确保了：
- 精确的距离场计算
- 正确的分形几何结构
- 高效的GPU渲染性能

### 算法参考
SDF函数实现参考了以下资料：
- [Inigo Quilez - Distance Functions](https://iquilezles.org/articles/menger/)
- [Menger Sponge SDF](https://www.shadertoy.com/) 相关实现
- 经典分形几何学理论

### 着色器支持
在`shaders/raymarch.frag`中实现了`sdMengerSponge`函数，支持：
- 动态迭代次数
- 精确的距离计算
- 优化的性能表现

## 支持的几何体
- 球体 (Sphere)
- 立方体 (Cuboid)  
- 圆锥 (Cone)
- 圆柱 (Cylinder)
- 四面体 (Tetrahedron)
- 平面 (Plane)
- **Menger Sponge（新增）**

## CSG操作
- 并集 (Union)
- 交集 (Intersection) 
- 差集 (Subtraction)

## 项目结构
```
ISR/
├── src/
│   ├── main.cpp          # 主程序
│   ├── glad.c           # OpenGL加载器
│   └── stb_image.h      # 图像加载库
├── dev/
│   ├── objects.h        # 物体定义
│   └── objects.cpp      # 物体实现
├── shaders/
│   ├── raymarch.vert    # 顶点着色器
│   ├── raymarch.frag    # 片段着色器（包含SDF函数）
│   └── glacier.hdr      # 环境贴图
└── README.md
```

## 致谢
- Ray marching技术基于Inigo Quilez的工作
- Menger sponge SDF算法参考了分形几何学相关文献
