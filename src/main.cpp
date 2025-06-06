// main.cpp
#define STB_IMAGE_IMPLEMENTATION
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
#include "stb_image.h" 
#include <string> 
#include <glm/gtc/matrix_transform.hpp>
#include <glad/glad.h>
#include <glm/glm.hpp>

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

static const char* vsSrc = R"(#version 330 core
layout(location=0) in vec3 aPos;
out vec3 vDir;
uniform mat4 uView;   // 每个面单独传
void main(){
    vDir = mat3(uView)*aPos;    // 方向向量 (已旋转到当前面)
    gl_Position = vec4(aPos,1.0);
})";

static const char* fsSrc = R"(#version 330 core
in  vec3 vDir;
out vec4 FragColor;
uniform sampler2D equirect;    // 已加载的 2D HDR
const float PI = 3.1415926;
void main(){
    vec3 d = normalize(vDir);
    float u = atan(d.z, d.x) / (2.0*PI) + 0.5;
    float v = asin(clamp(d.y,-1,1)) / PI + 0.5;
    vec3 hdr = textureLod(equirect, vec2(u,1.0-v), 0.0).rgb; // 反转 v
    FragColor = vec4(hdr,1.0);
})";

/* -------------------------------------------------------------- */
GLuint equirectToCubemap(const std::string& path, int cubemapSize = 1024)
{
    /* 1. 读取 HDR 到 2D 纹理 */
    int w,h,comp;
    float* data = stbi_loadf(path.c_str(), &w,&h,&comp, 0);
    if(!data){ fprintf(stderr,"load %s fail\n",path.c_str()); return 0; }

    GLuint tex2D; glGenTextures(1, &tex2D);
    glBindTexture(GL_TEXTURE_2D, tex2D);
    GLenum fmt = (comp==3) ? GL_RGB : GL_RGBA;
    glTexImage2D(GL_TEXTURE_2D,0,GL_RGB16F,w,h,0,fmt,GL_FLOAT,data);
    glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_LINEAR);
    glBindTexture(GL_TEXTURE_2D,0);
    stbi_image_free(data);

    /* 2. 创建空 Cubemap */
    GLuint cube; glGenTextures(1,&cube);
    glBindTexture(GL_TEXTURE_CUBE_MAP,cube);
    for(int i=0;i<6;++i)
        glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X+i,0,GL_RGB16F,
                     cubemapSize,cubemapSize,0,GL_RGB,GL_FLOAT,nullptr);
    glTexParameteri(GL_TEXTURE_CUBE_MAP,GL_TEXTURE_MIN_FILTER,GL_LINEAR_MIPMAP_LINEAR);
    glTexParameteri(GL_TEXTURE_CUBE_MAP,GL_TEXTURE_MAG_FILTER,GL_LINEAR);
    glTexParameteri(GL_TEXTURE_CUBE_MAP,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP,GL_TEXTURE_WRAP_R,GL_CLAMP_TO_EDGE);

    /* 3. FBO 与着色器 */
    GLuint fbo; glGenFramebuffers(1,&fbo);
    GLuint rbo; glGenRenderbuffers(1,&rbo);           // 无需深度
    glBindFramebuffer(GL_FRAMEBUFFER,fbo);
    glBindRenderbuffer(GL_RENDERBUFFER,rbo);
    glRenderbufferStorage(GL_RENDERBUFFER,GL_DEPTH_COMPONENT24,cubemapSize,cubemapSize);
    glFramebufferRenderbuffer(GL_FRAMEBUFFER,GL_DEPTH_ATTACHMENT,GL_RENDERBUFFER,rbo);

    GLuint vs = compileShader(GL_VERTEX_SHADER,vsSrc);
    GLuint fs = compileShader(GL_FRAGMENT_SHADER,fsSrc);
    GLuint prog = linkProgram(vs,fs);
    glDeleteShader(vs); glDeleteShader(fs);

    GLuint vao,vbo;
    float cubeVerts[] = {
        -1,-1,-1,  1,-1,-1,  1, 1,-1,  1, 1,-1, -1, 1,-1, -1,-1,-1, // -Z
        -1,-1, 1,  1,-1, 1,  1, 1, 1,  1, 1, 1, -1, 1, 1, -1,-1, 1, // +Z
        -1, 1,-1,  1, 1,-1,  1, 1, 1,  1, 1, 1, -1, 1, 1, -1, 1,-1, // +Y
        -1,-1,-1,  1,-1,-1,  1,-1, 1,  1,-1, 1, -1,-1, 1, -1,-1,-1, // -Y
        1,-1,-1,  1,-1, 1,  1, 1, 1,  1, 1, 1,  1, 1,-1,  1,-1,-1, // +X
       -1,-1,-1, -1,-1, 1, -1, 1, 1, -1, 1, 1, -1, 1,-1, -1,-1,-1  // -X
    };
    glGenVertexArrays(1,&vao);
    glGenBuffers(1,&vbo);
    glBindVertexArray(vao);
    glBindBuffer(GL_ARRAY_BUFFER,vbo);
    glBufferData(GL_ARRAY_BUFFER,sizeof(cubeVerts),cubeVerts,GL_STATIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0,3,GL_FLOAT,GL_FALSE,3*sizeof(float),0);

    /* 4. 视矩阵 (lookAt 六方向) */
    glm::mat4 views[6] = {
        glm::lookAt(glm::vec3(0), glm::vec3(-1,0,0), glm::vec3(0,-1,0)), // +X
        glm::lookAt(glm::vec3(0), glm::vec3(1,0,0), glm::vec3(0,-1,0)), // -X
        glm::lookAt(glm::vec3(0), glm::vec3(0, 1,0), glm::vec3(0,0,1)),  // +Y
        glm::lookAt(glm::vec3(0), glm::vec3(0,-1,0), glm::vec3(0,0,-1)), // -Y
        glm::lookAt(glm::vec3(0), glm::vec3(0,0, 1), glm::vec3(0,-1,0)), // +Z
        glm::lookAt(glm::vec3(0), glm::vec3(0,0,-1), glm::vec3(0,-1,0))  // -Z
    };

    /* 5. 渲染到 6 面 */
    glUseProgram(prog);
    glUniform1i(glGetUniformLocation(prog,"equirect"),0);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D,tex2D);

    glViewport(0,0,cubemapSize,cubemapSize);
    for(int i=0;i<6;++i){
        glUniformMatrix4fv(glGetUniformLocation(prog,"uView"),1,GL_FALSE,&views[i][0][0]);
        glFramebufferTexture2D(GL_FRAMEBUFFER,GL_COLOR_ATTACHMENT0,
                               GL_TEXTURE_CUBE_MAP_POSITIVE_X+i,cube,0);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        glBindVertexArray(vao);
        glDrawArrays(GL_TRIANGLES,0,36);
    }
    glBindFramebuffer(GL_FRAMEBUFFER,0);

    glDeleteVertexArrays(1,&vao);
    glDeleteBuffers(1,&vbo);
    glDeleteProgram(prog);
    glDeleteTextures(1,&tex2D);
    glDeleteRenderbuffers(1,&rbo);
    glDeleteFramebuffers(1,&fbo);

    /* 6. 生成 Mip-map 后返回 cubemap 句柄 */
    glBindTexture(GL_TEXTURE_CUBE_MAP,cube);
    glGenerateMipmap(GL_TEXTURE_CUBE_MAP);
    return cube;
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

    GLuint envTex = equirectToCubemap("shaders/glacier.hdr", 1024);                         

    /* ---------- 3. 编译 / 链接着色器 ---------- */
    std::string vsrc = loadShader("shaders/raymarch.vert");
    std::string fsrc = loadShader("shaders/raymarch.frag");
    GLuint vs = compileShader(GL_VERTEX_SHADER, vsrc.c_str());
    GLuint fs = compileShader(GL_FRAGMENT_SHADER, fsrc.c_str());
    GLuint prog = linkProgram(vs, fs);

    glUseProgram(prog);

    /* ① 告诉着色器：uEnvMap 来自 texture unit 1 */
    glUniform1i(glGetUniformLocation(prog, "uEnvMap"), 1);

    glUniform1i(glGetUniformLocation(prog,"uEnvEnable"), 0);   // 1 = ON

    /* ② 依旧把 objectBuffer 绑定到槽 0（已有） */
    glUniform1i(glGetUniformLocation(prog, "objectBuffer"), 0);

    /* ---------- 4. 在 CPU 端创建任意数量的物体 ---------- */
    using namespace Objects;
    CSG_tree tree = CSG_tree();
    auto* ground = tree.create_plane({0.7f,0.7f,0.7f,1},   // 淡灰色
                                 {0.0f,1.0f,0.0f},     // 法向量朝 +Y
                                 -1.0f);                // y = -1 → dot(p,n)+h=0

    // 创建不同迭代次数的Menger sponge来展示分形效果
    
    // 迭代0次 - 普通立方体
    auto* menger0 = tree.create_menger_sponge({1.0f, 0.2f, 0.2f, 1.0f},   // 红色
                                           glm::vec3(-6.0f, 1.0f, 0.0f),   
                                           1.5f,                          
                                           0);                            

    // 迭代1次
    auto* menger1 = tree.create_menger_sponge({0.8f, 0.4f, 0.2f, 1.0f},   // 橙色
                                           glm::vec3(-2.0f, 1.0f, 0.0f),   
                                           1.5f,                          
                                           1);                            

    // 迭代2次
    auto* menger2 = tree.create_menger_sponge({0.6f, 0.6f, 0.2f, 1.0f},   // 黄色
                                           glm::vec3(2.0f, 1.0f, 0.0f),    
                                           1.5f,                          
                                           2);                            

    // 迭代3次
    auto* menger3 = tree.create_menger_sponge({0.2f, 0.8f, 0.4f, 1.0f},   // 绿色
                                           glm::vec3(6.0f, 1.0f, 0.0f),    
                                           1.5f,                          
                                           3);

    // 在背景添加一个大的Menger sponge
    auto* menger_bg = tree.create_menger_sponge({0.3f, 0.3f, 0.8f, 0.8f}, // 半透明蓝色
                                             glm::vec3(0.0f, 4.0f, 8.0f),    
                                             4.0f,                          
                                             2);

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

        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_CUBE_MAP, envTex);

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
