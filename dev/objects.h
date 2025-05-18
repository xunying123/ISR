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
    };

    struct Color {
        float r, g, b, a;
    };

    struct Object {
        Object_type type;
        Color color;
        float pos_args[12];

        std::vector<float> packObjectToTextureData();
        void translate(const glm::vec3& d);
        void scale(float s);
    };

    Object create_sphere(Color color, glm::vec3 center, float radius);

    Object create_cone(Color color, glm::vec3 center, glm::vec3 vertex, float radius);

    Object create_cylinder(Color color, glm::vec3 center1, glm::vec3 center2, float radius);

    Object create_cuboid(Color color, glm::vec3 center, float alpha, float beta, float gamma, float length, float width, float height);

    Object create_tetrahedron(Color color, glm::vec3 vertex1, glm::vec3 vertex2, glm::vec3 vertex3, glm::vec3 vertex4);

}
#endif //ISR_OBJECTS_H
