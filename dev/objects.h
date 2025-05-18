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
        DIFFERENCE
    };

    struct Color {
        float r, g, b, a;
    };

    class Object {
        friend class CSG_tree;

        Object_type type;
        Color color{};
        float pos_args[12]{};
        Object *left = nullptr;
        Object *right = nullptr;
        Object *parent = nullptr;

        std::vector<float> packObjectToTextureData();

    public:
        Object(Object_type type, Color color, std::initializer_list<float> pos_args,
               Object *left = nullptr, Object *right = nullptr);

        void translate(const glm::vec3 &d);

        void scale(float s);
    };

    class CSG_tree {

        Object *root;
        std::vector<Object *> object_list;

        void generate_texture_data_postorder(Object *object,
                                             std::vector<std::vector<float>> &textureData);

    public:
        CSG_tree();

        ~CSG_tree();

        std::vector<std::vector<float>> generate_texture_data();

        Object *create_sphere(Color color, glm::vec3 center, float radius);

        Object *create_cone(Color color, glm::vec3 center, glm::vec3 vertex, float radius);

        Object *create_cylinder(Color color, glm::vec3 center1, glm::vec3 center2, float radius);

        Object *create_cuboid(Color color, glm::vec3 center, float length, float width,
                              float height, float alpha, float beta, float gamma);

        Object *create_tetrahedron(Color color, glm::vec3 vertex1, glm::vec3 vertex2,
                                   glm::vec3 vertex3, glm::vec3 vertex4);

        Object *create_intersection(Object *left, Object *right);

        Object *create_union(Object *left, Object *right);

        Object *create_subtract(Object *left, Object *right);
    };

}


#endif //ISR_OBJECTS_H
