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
    };

    Object create_sphere(glm::vec3 center, Color color, float radius);

    Object create_cone(glm::vec3 center, Color color, glm::vec3 vertex, float radius);

    Object create_cylinder(glm::vec3 center1, Color color, glm::vec3 center2, float radius);

    Object create_cuboid(glm::vec3 center, Color color, float length, float width, float height);

    Object create_tetrahedron(glm::vec3 vertex1, Color color, glm::vec3 vertex2, glm::vec3 vertex3, glm::vec3 vertex4);

}
#endif //ISR_OBJECTS_H
