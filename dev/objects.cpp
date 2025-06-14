#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <iostream>
#include "objects.h"

glm::vec3 matrixToEulerZYX(const glm::mat3 &m) {
    float sy = std::sqrt(m[0][0] * m[0][0] + m[1][0] * m[1][0]);
    bool singular = sy < 1e-6f;
    float x, y, z;           // x→roll(γ), y→pitch(β), z→yaw(α)
    if (!singular) {
        x = std::atan2(m[2][1], m[2][2]);
        y = std::atan2(-m[2][0], sy);
        z = std::atan2(m[1][0], m[0][0]);
    } else {                 // gimbal lock
        x = std::atan2(-m[1][2], m[1][1]);
        y = std::atan2(-m[2][0], sy);
        z = 0.0f;
    }
    return glm::vec3(x, y, z);     // (γ,β,α)
}

namespace Objects {

    std::vector<float> Object::packObjectToTextureData() {
        std::vector<float> textureData(32);
        textureData[0] = static_cast<float>(type); // type
        textureData[1] = color.r; // R
        textureData[2] = color.g; // G
        textureData[3] = color.b; // B
        textureData[4] = color.a; // A
        for (int i = 0; i < 28; ++i) {
            textureData[5 + i] = pos_args[i];
        }
        return textureData;
    }

    Object::Object(Objects::Object_type type, Objects::Color color,
                   std::initializer_list<float> pos_args,
                   Objects::Object *left, Objects::Object *right) {
        this->type = type;
        this->color = color;
        for (int i = 0; i < pos_args.size(); ++i) {
            this->pos_args[i] = pos_args.begin()[i];
        }
        this->left = left;
        this->right = right;
        if (left != nullptr) {
            left->parent = this;
        }
        if (right != nullptr) {
            right->parent = this;
        }
    }

    CSG_tree::CSG_tree() {
        root = nullptr;
        object_list = std::vector<Object *>();
    }

    CSG_tree::~CSG_tree() {
        for (Object *object: object_list) {
            delete object;
        }
    }

    void CSG_tree::get_min_stack_order(Objects::Object *object) {
        assert((object->left == nullptr && object->right == nullptr) ||
               (object->left != nullptr && object->right != nullptr));
        if (object->left != nullptr) {
            get_min_stack_order(object->left);
            get_min_stack_order(object->right);
        }
        if (object->left == nullptr) {
            object->max_stack_length = 1;
        } else {
            assert(object->left != nullptr && object->right != nullptr);
            int first_left_length = std::max(1 + object->right->max_stack_length, object->left->max_stack_length);
            int first_right_length = std::max(1 + object->left->max_stack_length, object->right->max_stack_length);
            object->first_left = first_left_length <= first_right_length;
            object->max_stack_length = std::min(first_left_length, first_right_length);
        }
    }

    void CSG_tree::generate_texture_data_postorder(Objects::Object *object,
                                                   std::vector<std::vector<float>> &textureData) {
        assert((object->left == nullptr && object->right == nullptr) ||
               (object->left != nullptr && object->right != nullptr));
        if (object->left != nullptr) {
            if (object->first_left) {
                generate_texture_data_postorder(object->left, textureData);
                generate_texture_data_postorder(object->right, textureData);
            } else {
                generate_texture_data_postorder(object->right, textureData);
                generate_texture_data_postorder(object->left, textureData);
            }
        }
        textureData.push_back(object->packObjectToTextureData());
    }

    std::vector<std::vector<float>> CSG_tree::generate_texture_data() {
        // build all the elements into the tree
        for (Object *object: object_list) {
            if (object->parent != nullptr) {
                continue;
            }
            if (root == nullptr) {
                root = object;
            } else {
                root = create_union(root, object);
            }
        }
        // postorder traversal
        get_min_stack_order(root);
        std::vector<std::vector<float>> textureData;
        generate_texture_data_postorder(root, textureData);
        if (root->max_stack_length > 8) {
            std::cout << "[Error] Oversized stack.Max stack length: " << root->max_stack_length << std::endl;
            assert(false);
        }
        return textureData;
    }

    Object *CSG_tree::create_sphere(Color color, glm::vec3 center, float radius, float texture, float para) {
        auto *sphere = new Object(SPHERE, color, {center.x, center.y, center.z, radius, texture, para});
        object_list.push_back(sphere);
        return sphere;
    }

    Object *CSG_tree::create_cone(Color color, glm::vec3 center, glm::vec3 vertex, float radius, 
                                   float texture, float para) {
        auto *cone = new Object(CONE, color, {center.x, center.y, center.z,
                                              vertex.x, vertex.y, vertex.z, radius, texture, para});
        object_list.push_back(cone);
        return cone;
    }

    Object *CSG_tree::create_cylinder(Color color, glm::vec3 center1, glm::vec3 center2, float radius, 
                                       float texture, float para) {
        auto *cylinder = new Object(CYLINDER, color, {center1.x, center1.y, center1.z,
                                                      center2.x, center2.y, center2.z, radius, texture, para});
        object_list.push_back(cylinder);
        return cylinder;
    }

    Object *CSG_tree::create_cuboid(Color color, glm::vec3 center, float length, float width,
                                    float height, float alpha, float beta, float gamma, float texture, float para) {
        auto *cuboid = new Object(CUBOID, color, {center.x, center.y, center.z, length, width, height, alpha, beta, gamma, texture, para});
        object_list.push_back(cuboid);
        return cuboid;
    }

    Object *CSG_tree::create_tetrahedron(Color color, glm::vec3 vertex1, glm::vec3 vertex2,
                                         glm::vec3 vertex3, glm::vec3 vertex4, float texture, float para) {
        auto *tetrahedron = new Object(TETRAHEDRON, color, {vertex1.x, vertex1.y, vertex1.z,
                                                            vertex2.x, vertex2.y, vertex2.z,
                                                            vertex3.x, vertex3.y, vertex3.z,
                                                            vertex4.x, vertex4.y, vertex4.z, texture, para});
        object_list.push_back(tetrahedron);
        return tetrahedron;
    }

    Object *CSG_tree::create_intersection(Object *left, Object *right) {
        auto *intersection = new Object(INTERSECTION, {1.0f, 1.0f, 1.0f, 1.0f}, {}, left, right);
        object_list.push_back(intersection);
        return intersection;
    }

    Object *CSG_tree::create_union(Object *left, Object *right) {
        auto *unionObj = new Object(UNION, {1.0f, 1.0f, 1.0f, 1.0f}, {}, left, right);
        object_list.push_back(unionObj);
        return unionObj;
    }

    Object *CSG_tree::create_subtract(Object *left, Object *right) {
        auto *difference = new Object(DIFFERENCE, {1.0f, 1.0f, 1.0f, 1.0f}, {}, left, right);
        object_list.push_back(difference);

        return difference;
    }

    Object *CSG_tree::create_plane(Color color,
                                   glm::vec3 normal,
                                   float h, float texture, float para) {
        auto *plane = new Object(PLANE, color, {normal.x, normal.y, normal.z, -h, texture, para});
        object_list.push_back(plane);
        return plane;
    }

    Object *CSG_tree::create_menger_sponge(Color color, glm::vec3 center, float size, int iterations, 
                                            float texture, float para) {
        auto *menger = new Object(MENGER_SPONGE, color, {center.x, center.y, center.z, size, static_cast<float>(iterations), texture, para});
        object_list.push_back(menger);
        return menger;
    }

    Object *CSG_tree::create_mandelbulb(Color color, glm::vec3 center, float scale, 
                                        float power, int max_iterations, 
                                        float texture, float para) {
        // 参数布局：center(3), scale(1), power(1), max_iterations(1), texture(1), para(1)
        auto *mandelbulb = new Object(MANDELBULB, color, {
            center.x, center.y, center.z,      // 0,1,2: center
            scale,                              // 3: scale  
            power,                              // 4: Mandelbulb幂次参数 (通常是8)
            static_cast<float>(max_iterations), // 5: 最大迭代次数
            texture, para                       // 6,7: 材质参数
        });
        object_list.push_back(mandelbulb);
        return mandelbulb;
    }

    Object *CSG_tree::create_julia_set_3d(Color color, glm::vec3 center, float scale, 
                                          glm::vec2 c_param, int max_iterations, 
                                          bool orbit_trap, float texture, float para) {
        // 参数布局：center(3), scale(1), c_param(2), max_iterations(1), orbit_trap(1), texture(1), para(1)
        auto *julia = new Object(JULIA_SET_3D, color, {
            center.x, center.y, center.z,      // 0,1,2: center
            scale,                              // 3: scale  
            c_param.x, c_param.y,              // 4,5: Julia参数c = c.x + c.y*i
            static_cast<float>(max_iterations), // 6: 最大迭代次数
            orbit_trap ? 1.0f : 0.0f,          // 7: orbit trap开关 (1.0=开启，0.0=关闭)
            texture, para                       // 8,9: 材质参数
        });
        object_list.push_back(julia);
        return julia;
    }

    void Object::translate(const glm::vec3 &d) {
        switch (type) {
            case SPHERE:
            case CUBOID:
            case MENGER_SPONGE:
            case MANDELBULB:
            case JULIA_SET_3D:
                pos_args[0] += d.x;
                pos_args[1] += d.y;
                pos_args[2] += d.z;
                break;
            case CONE:
            case CYLINDER:
                for (int i = 0; i < 6; ++i) pos_args[i] += d[i % 3];
                break;
            case TETRAHEDRON:
                for (int i = 0; i < 12; i += 3) {
                    pos_args[i] += d.x;
                    pos_args[i + 1] += d.y;
                    pos_args[i + 2] += d.z;
                }
                break;
        }
    }

    void Object::scale(float s) {
        switch (type) {
            case SPHERE:
                pos_args[3] *= s;
                break;
            case MENGER_SPONGE:
                pos_args[3] *= s;  // 缩放size参数
                break;
            case MANDELBULB:
                pos_args[3] *= s;  // 缩放scale参数
                break;
            case JULIA_SET_3D:
                pos_args[3] *= s;  // 缩放scale参数
                break;
            case CUBOID:
                pos_args[3] *= s;
                pos_args[4] *= s;
                pos_args[5] *= s;
                break;
            case CONE: {
                glm::vec3 base(pos_args[0], pos_args[1], pos_args[2]);
                glm::vec3 apex(pos_args[3], pos_args[4], pos_args[5]);
                float r = pos_args[6];

                apex = base + (apex - base) * s;

                r *= s;

                pos_args[3] = apex.x;
                pos_args[4] = apex.y;
                pos_args[5] = apex.z;
                pos_args[6] = r;
                break;
            }
            case CYLINDER: {
                glm::vec3 A(pos_args[0], pos_args[1], pos_args[2]);
                glm::vec3 B(pos_args[3], pos_args[4], pos_args[5]);
                glm::vec3 v = (B - A) * s;
                B = A + v;
                pos_args[3] = B.x;
                pos_args[4] = B.y;
                pos_args[5] = B.z;
                pos_args[6] *= s;
                break;
            }
            case TETRAHEDRON: {
                glm::vec3 v0(pos_args[0], pos_args[1], pos_args[2]);
                glm::vec3 v1(pos_args[3], pos_args[4], pos_args[5]);
                glm::vec3 v2(pos_args[6], pos_args[7], pos_args[8]);
                glm::vec3 v3(pos_args[9], pos_args[10], pos_args[11]);
                glm::vec3 c = (v0 + v1 + v2) / 3.0f;

                auto recalc = [&](glm::vec3 &v) {
                    v = c + (v - c) * s;
                };
                recalc(v0);
                recalc(v1);
                recalc(v2);
                recalc(v3);

                pos_args[0] = v0.x;
                pos_args[1] = v0.y;
                pos_args[2] = v0.z;
                pos_args[3] = v1.x;
                pos_args[4] = v1.y;
                pos_args[5] = v1.z;
                pos_args[6] = v2.x;
                pos_args[7] = v2.y;
                pos_args[8] = v2.z;
                pos_args[9] = v3.x;
                pos_args[10] = v3.y;
                pos_args[11] = v3.z;
                break;
            }
        }
    }

    void Object::rotate(const glm::vec3 &axis,
                        float angleRad,
                        const glm::vec3 &pivot) {
        glm::mat4 R4 = glm::rotate(glm::mat4(1.0f), angleRad, glm::normalize(axis));
        glm::mat3 R = glm::mat3(R4);

        auto apply = [&](float &x, float &y, float &z) {
            glm::vec3 p(x, y, z);
            p = glm::vec3(R * glm::vec4(p - pivot, 1.0f)) + pivot;
            x = p.x;
            y = p.y;
            z = p.z;
        };

        switch (type) {
            case SPHERE:
            case MENGER_SPONGE:
            case MANDELBULB:
            case JULIA_SET_3D:
                apply(pos_args[0], pos_args[1], pos_args[2]);
                break;

            case CUBOID: {
                apply(pos_args[0], pos_args[1], pos_args[2]);

                float alpha = pos_args[6];
                float beta = pos_args[7];
                float gamma = pos_args[8];

                glm::mat3 M_old = glm::mat3(
                        glm::rotate(glm::mat4(1.0f), alpha, glm::vec3(0, 0, 1)) *
                        glm::rotate(glm::mat4(1.0f), beta, glm::vec3(0, 1, 0)) *
                        glm::rotate(glm::mat4(1.0f), gamma, glm::vec3(1, 0, 0))
                );

                glm::mat3 M_new = R * M_old;
                glm::vec3 eul = matrixToEulerZYX(M_new);

                pos_args[6] = eul.z;   // α'
                pos_args[7] = eul.y;   // β'
                pos_args[8] = eul.x;   // γ'
                break;
            }

            case CONE:
            case CYLINDER:
                for (int i = 0; i < 6; i += 3)
                    apply(pos_args[i], pos_args[i + 1], pos_args[i + 2]);
                break;

            case TETRAHEDRON:
                for (int i = 0; i < 12; i += 3)
                    apply(pos_args[i], pos_args[i + 1], pos_args[i + 2]);
                break;

            default:
                break;
        }
    }


}