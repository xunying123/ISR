#ifndef ISR_OBJECTS_H
#define ISR_OBJECTS_H

#include <glm/vec3.hpp>
#include <vector>

namespace Objects {

    enum Object_type {
        SPHERE,
        CONE,
        CYLINDER,
        CUBOID,
        TETRAHEDRON,
        INTERSECTION,
        UNION,
        DIFFERENCE,
        PLANE,
        MENGER_SPONGE,
        MANDELBULB,
        JULIA_SET_3D,
    };

    struct Color {
        float r, g, b, a;
    };

    class Object {
        friend class CSG_tree;

        Object_type type;
        Color color{};
        float pos_args[28]{};
        Object *left = nullptr;
        Object *right = nullptr;
        Object *parent = nullptr;
        int max_stack_length = 0;
        bool first_left = true;

        std::vector<float> packObjectToTextureData();

    public:
        Object(Object_type type, Color color, std::initializer_list<float> pos_args,
               Object *left = nullptr, Object *right = nullptr);

        void translate(const glm::vec3 &d);

        void scale(float s);

        void rotate(const glm::vec3 &axis,
                    float angleRad,
                    const glm::vec3 &pivot = glm::vec3(0.0f));
    };

    class CSG_tree {

        Object *root;
        std::vector<Object *> object_list;

        void get_min_stack_order(Object *object);

        void generate_texture_data_postorder(Object *object,
                                             std::vector<std::vector<float>> &textureData);

    public:
        CSG_tree();

        ~CSG_tree();

        std::vector<std::vector<float>> generate_texture_data();

        Object *create_sphere(Color color, glm::vec3 center, float radius, float texture = 0, float para = 0.0f);

        Object *create_cone(Color color, glm::vec3 center, glm::vec3 vertex, float radius, 
                            float texture = 0, float para = 0.0f);

        Object *create_cylinder(Color color, glm::vec3 center1, glm::vec3 center2, float radius, 
                                float texture = 0, float para = 0.0f);

        Object *create_cuboid(Color color, glm::vec3 center, float length, float width,
                              float height, float alpha, float beta, float gamma, float texture = 0, float para = 0.0f);

        Object *create_tetrahedron(Color color, glm::vec3 vertex1, glm::vec3 vertex2,
                                   glm::vec3 vertex3, glm::vec3 vertex4, float texture = 0, float para = 0.0f);

        Object *create_plane(Color color,
                             glm::vec3 normal, float h, float texture = 0, float para = 0.0f);

        Object *create_menger_sponge(Color color, glm::vec3 center, float size, int iterations, 
                                     float texture = 0, float para = 0.0f);

        Object *create_mandelbulb(Color color, glm::vec3 center, float scale, 
                                  float power = 8.0f, int max_iterations = 64, 
                                  float texture = 0, float para = 0.0f);

        Object *create_julia_set_3d(Color color, glm::vec3 center, float scale, 
                                    glm::vec2 c_param, int max_iterations = 64, 
                                    bool orbit_trap = false, float texture = 0, float para = 0.0f);

        Object *create_intersection(Object *left, Object *right);

        Object *create_union(Object *left, Object *right);

        Object *create_subtract(Object *left, Object *right);

    };

}


#endif //ISR_OBJECTS_H
