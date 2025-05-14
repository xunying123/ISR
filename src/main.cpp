// main.cpp
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <glm/vec3.hpp>
#include <iostream>
#include <vector>

#include "objects.h"         
#include <fstream>
#include <sstream>

std::string loadShader(const char* path)
{
    std::ifstream ifs(path, std::ios::binary);
    if(!ifs) {
        std::cerr << "无法打开着色器文件: " << path << '\n';
        return "";
    }
    std::ostringstream oss;
    oss << ifs.rdbuf();
    return oss.str();
}

GLuint compileShader(GLenum type, const char* src)
{
    GLuint s = glCreateShader(type);
    glShaderSource(s, 1, &src, nullptr);
    glCompileShader(s);

    GLint ok = 0;
    glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
    if(!ok){
        char log[1024];
        glGetShaderInfoLog(s, 1024, nullptr, log);
        std::cerr << "着色器编译失败:\n" << log << '\n';
    }
    return s;
}

GLuint linkProgram(GLuint vs, GLuint fs)
{
    GLuint p = glCreateProgram();
    glAttachShader(p, vs);
    glAttachShader(p, fs);
    glLinkProgram(p);

    GLint ok = 0;
    glGetProgramiv(p, GL_LINK_STATUS, &ok);
    if(!ok){
        char log[1024];
        glGetProgramInfoLog(p, 1024, nullptr, log);
        std::cerr << "Program 链接失败:\n" << log << '\n';
    }
    glDeleteShader(vs);
    glDeleteShader(fs);
    return p;
}

int main()
{
    /* ---------- 1. 初始化窗口与 OpenGL ---------- */
    if (!glfwInit()) return -1;
    GLFWwindow* win = glfwCreateWindow(1280, 720, "Ray Marching", nullptr, nullptr);
    if (!win) { glfwTerminate(); return -1; }
    glfwMakeContextCurrent(win);
    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) return -1;
    glfwSwapInterval(1);

    /* ---------- 2. 创建全屏四边形 ---------- */
    float quad[8] = { -1,-1,  1,-1,  -1, 1,  1, 1 };       // 两个三角形 strip
    GLuint vao,vbo;
    glGenVertexArrays(1,&vao);
    glGenBuffers(1,&vbo);
    glBindVertexArray(vao);
    glBindBuffer(GL_ARRAY_BUFFER,vbo);
    glBufferData(GL_ARRAY_BUFFER,sizeof(quad),quad,GL_STATIC_DRAW);
    glVertexAttribPointer(0,2,GL_FLOAT,GL_FALSE,0,nullptr);
    glEnableVertexAttribArray(0);

    /* ---------- 3. 编译 / 链接着色器 ---------- */
    std::string vsrc = loadShader("shaders/raymarch.vert");
    std::string fsrc = loadShader("shaders/raymarch.frag");
    GLuint vs = compileShader(GL_VERTEX_SHADER  , vsrc.c_str());
    GLuint fs = compileShader(GL_FRAGMENT_SHADER, fsrc.c_str());
    GLuint prog = linkProgram(vs, fs);

    /* ---------- 4. 在 CPU 端创建任意数量的物体 ---------- */
    using namespace Objects;
    std::vector<Object> cpuObjs;
    cpuObjs.push_back(create_tetrahedron({0,0,1}, {0.2,1,0.2,1},
                                        {1,0,1}, {1,1,1}, {0,0,2})); // 紫色

    /* ---------- 5. 打包成连续 float ---------- */
    std::vector<float> gpuData;
    gpuData.reserve(cpuObjs.size()*32);          // 每个物体 32 float
    for (auto& obj : cpuObjs) {
        auto v = obj.packObjectToTextureData();
        gpuData.insert(gpuData.end(), v.begin(), v.end());
    }

    /* ---------- 6. 生成 TBO + 纹理 ---------- */
    GLuint tbo, tex;
    glGenBuffers(1,&tbo);
    glBindBuffer(GL_TEXTURE_BUFFER, tbo);
    glBufferData(GL_TEXTURE_BUFFER,
                 gpuData.size()*sizeof(float),
                 gpuData.data(),
                 GL_DYNAMIC_DRAW);              // 动态：以后可 glBufferSubData

    glGenTextures(1,&tex);
    glBindTexture(GL_TEXTURE_BUFFER, tex);
    glTexBuffer(GL_TEXTURE_BUFFER, GL_RGBA32F, tbo);

    /* ---------- 7. 渲染循环 ---------- */
    while(!glfwWindowShouldClose(win))
    {
        /* 7-1 更新窗口尺寸 / 清屏 */
        int w,h; glfwGetFramebufferSize(win,&w,&h);
        glViewport(0,0,w,h);
        glClear(GL_COLOR_BUFFER_BIT);

        /* 7-2 绑定纹理并设置 uniform */
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_BUFFER, tex);

        glUseProgram(prog);
        glUniform1i (glGetUniformLocation(prog,"objectBuffer"), 0);              // 绑定槽 0
        glUniform1i (glGetUniformLocation(prog,"numObjects"),   (int)cpuObjs.size());
        glUniform2f(glGetUniformLocation(prog,"iResolution"),   (float)w, (float)h);
        glUniform1f(glGetUniformLocation(prog,"iTime"),         (float)glfwGetTime());

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
