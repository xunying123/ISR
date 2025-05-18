// main.cpp
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <glm/ext/vector_float3.hpp>
#include <glm/vec3.hpp>
#include <glm/gtx/rotate_vector.hpp>
#include <iostream>
#include <vector>
#include "objects.h"
#include <fstream>
#include <sstream>

std::string loadShader(const char *path) {
    std::ifstream ifs(path, std::ios::binary);
    if (!ifs) {
        std::cerr << "无法打开着色器文件: " << path << '\n';
        return "";
    }
    std::ostringstream oss;
    oss << ifs.rdbuf();
    return oss.str();
}

GLuint compileShader(GLenum type, const char *src) {
    GLuint s = glCreateShader(type);
    glShaderSource(s, 1, &src, nullptr);
    glCompileShader(s);

    GLint ok = 0;
    glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
    if (!ok) {
        char log[1024];
        glGetShaderInfoLog(s, 1024, nullptr, log);
        std::cerr << "着色器编译失败:\n" << log << '\n';
    }
    return s;
}

GLuint linkProgram(GLuint vs, GLuint fs) {
    GLuint p = glCreateProgram();
    glAttachShader(p, vs);
    glAttachShader(p, fs);
    glLinkProgram(p);

    GLint ok = 0;
    glGetProgramiv(p, GL_LINK_STATUS, &ok);
    if (!ok) {
        char log[1024];
        glGetProgramInfoLog(p, 1024, nullptr, log);
        std::cerr << "Program 链接失败:\n" << log << '\n';
    }
    glDeleteShader(vs);
    glDeleteShader(fs);
    return p;
}

int main() {
    /* ---------- 1. 初始化窗口与 OpenGL ---------- */
    if (!glfwInit()) return -1;
    GLFWwindow *win = glfwCreateWindow(1280, 720, "Ray Marching", nullptr, nullptr);
    if (!win) {
        glfwTerminate();
        return -1;
    }
    glfwMakeContextCurrent(win);
    if (!gladLoadGLLoader((GLADloadproc) glfwGetProcAddress)) return -1;
    glfwSwapInterval(1);

    /* ---------- 2. 创建全屏四边形 ---------- */
    float quad[8] = {-1, -1, 1, -1, -1, 1, 1, 1};       // 两个三角形 strip
    GLuint vao, vbo;
    glGenVertexArrays(1, &vao);
    glGenBuffers(1, &vbo);
    glBindVertexArray(vao);
    glBindBuffer(GL_ARRAY_BUFFER, vbo);
    glBufferData(GL_ARRAY_BUFFER, sizeof(quad), quad, GL_STATIC_DRAW);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 0, nullptr);
    glEnableVertexAttribArray(0);

    /* ---------- 3. 编译 / 链接着色器 ---------- */
    std::string vsrc = loadShader("shaders/raymarch.vert");
    std::string fsrc = loadShader("shaders/raymarch.frag");
    GLuint vs = compileShader(GL_VERTEX_SHADER, vsrc.c_str());
    GLuint fs = compileShader(GL_FRAGMENT_SHADER, fsrc.c_str());
    GLuint prog = linkProgram(vs, fs);

    /* ---------- 4. 在 CPU 端创建任意数量的物体 ---------- */
    using namespace Objects;
    CSG_tree tree = CSG_tree();
    // Object *obj1 = tree.create_cuboid({0.2f, 0.8f, 0.2f, 1},
    //                                   glm::vec3(-2.0f, 2.0f, 0.0f),
    //                                   2.0f, 2.0f, 2.0f, 0.0f, 0.0f, 0.0f);
    // Object *obj2 = tree.create_sphere({0.2f, 0.2f, 0.8f, 1},
    //                                   glm::vec3(-2.0f, 2.0f, 0.0f), 1.2f);
    // Object *obj3 = tree.create_subtract(obj1, obj2);

//            cpuObjs.push_back(create_cuboid({0.2f, 0.8f, 0.2f, 1},
//                                            glm::vec3(-2.0f, 0.5f, 0.0f),
//                                            0.5f, 0.5f, 0.5f, 3.0f, 3.0f, 3.0f));
    // cpuObjs.push_back(create_cone(glm::vec3(3.f,2.f,0.f),
    //                                 {1.f,0.f,0.f,1},         
    //                                 glm::vec3(-1.f, 3.f, 0.f),
    //                                 1.f));       
    // cpuObjs.push_back(create_cylinder(glm::vec3(0.f,0.f,0.f),
    //                                 {0.2f,0.2f,0.8f,1},
    //                                 glm::vec3(0.f, 2.f, 0.f),
    //                                 0.5f));
    // tree.create_tetrahedron({1.f,0.f,0.f,1},
    //                                 glm::vec3(-0.5f,0.f,0.f),
    //                                 glm::vec3(0.5f, 0.f, 0.f),
    //                                 glm::vec3(0.f, 0.866f, 0.f),
    //                                 glm::vec3(0.f, 0.289f, 0.816f));
    auto* box = tree.create_cuboid({1,0,0,1},
                               {0,0,0}, 2,2,2,
                               0,0,0);   // α,β,γ=0
    box->rotate(glm::vec3(0,0,1), glm::radians(45.0f),
                glm::vec3(0.0f));   
    box->rotate(glm::vec3(1,0,0), glm::radians(45.0f),
                glm::vec3(0.0f));
    // cpuObjs.push_back(create_sphere({0.2f,0.8f,0.2f,1},
    //                                 glm::vec3(0.f,0.f,0.f),
    //                                 0.5f));            
    // cpuObjs[0].scale(5.0f);         // 缩放   
    // cpuObjs[0].translate(glm::vec3(1.0f, 1.0f, 10.0f)); // 平移
//    /* 1. 红色球（向上抬 0.5） */
//    Object sph = create_sphere({1.0f,0.3f,0.3f,1.0f},
//                               {0.0f,0.0f,0.0f}, 1.0f);
//    sph.translate({0.0f,0.5f,0.0f});
//    cpuObjs.push_back(sph);
//
//    /* 2. 橙色圆锥（底面中心固定在地面 (-3,0,0)）*/
//    cpuObjs.push_back(
//        create_cone({1.0f,0.6f,0.2f,1.0f},
//                    {-3.0f,1.0f,0.0f},         // baseCenter
//                    {-3.0f,3.0f,0.0f},         // apex
//                    1.0f));                    // 半径
//
//    /* 3. 蓝色圆柱（竖直，scale 放大 1.5 倍）*/
//    Object cyl = create_cylinder({0.2f,0.6f,1.0f,1.0f},
//                                 { 2.0f,0.0f, 2.0f},    // 端点 A (支点)
//                                 { 2.0f,2.0f, 2.0f},    // 端点 B
//                                 0.4f);                 // 半径
//    cyl.scale(1.5f);
//    cyl.translate({0.0f,1.0f,0.0f});      // 向上抬 0.5
//    cpuObjs.push_back(cyl);

    /* ---------- 5. 打包成连续 float ---------- */
    std::vector<float> gpuData;
    auto data = tree.generate_texture_data();  // 每个物体 32 float
    gpuData.reserve(data.size() * 32);
    for (auto &d: data) {
        gpuData.insert(gpuData.end(), d.begin(), d.end());
    }


    /* ---------- 6. 生成 TBO + 纹理 ---------- */
    GLuint tbo, tex;
    glGenBuffers(1, &tbo);
    glBindBuffer(GL_TEXTURE_BUFFER, tbo);
    glBufferData(GL_TEXTURE_BUFFER,
                 gpuData.size() * sizeof(float),
                 gpuData.data(),
                 GL_DYNAMIC_DRAW);              // 动态：以后可 glBufferSubData

    glGenTextures(1, &tex);
    glBindTexture(GL_TEXTURE_BUFFER, tex);
    glTexBuffer(GL_TEXTURE_BUFFER, GL_RGBA32F, tbo);

    /* ---------- 7. 渲染循环 ---------- */
    while (!glfwWindowShouldClose(win)) {
        /* 7-1 更新窗口尺寸 / 清屏 */
        int w, h;
        glfwGetFramebufferSize(win, &w, &h);
        glViewport(0, 0, w, h);
        glClear(GL_COLOR_BUFFER_BIT);

        /* 7-2 绑定纹理并设置 uniform */
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_BUFFER, tex);

        glUseProgram(prog);
        glUniform1i(glGetUniformLocation(prog, "objectBuffer"), 0);              // 绑定槽 0
        glUniform1i(glGetUniformLocation(prog, "numObjects"), (int) data.size());
        glUniform2f(glGetUniformLocation(prog, "iResolution"), (float) w, (float) h);
        glUniform1f(glGetUniformLocation(prog, "iTime"), (float) glfwGetTime());

        /* 7-3 画全屏 quad */
        glBindVertexArray(vao);
        glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);

        glfwSwapBuffers(win);
        glfwPollEvents();
    }

    /* ---------- 8. 资源释放 ---------- */
    glfwTerminate();
    return 0;
}
