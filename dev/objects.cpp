#include "Objects.h"

std::vector<float> Objects::Object::packObjectToTextureData(const Objects::Object &obj) {
    std::vector<float> textureData(32);
    textureData[0] = static_cast<float>(obj.type); // type
    textureData[1] = obj.color.r; // R
    textureData[2] = obj.color.g; // G
    textureData[3] = obj.color.b; // B
    textureData[4] = obj.color.a; // A
    for (int i = 0; i < 12; ++i) {
        textureData[5 + i] = obj.pos_args[i];
    }
    return textureData;
}

Objects::Object Objects::create_sphere(glm::vec3 center, Color color, float radius) {
    return Object{SPHERE, color, {center.x, center.y, center.z, radius}};
}

Objects::Object Objects::create_cone(glm::vec3 center, Color color, glm::vec3 vertex, float radius) {
    return Object{CONE, color, {center.x, center.y, center.z, vertex.x, vertex.y, vertex.z, radius}};
}

Objects::Object Objects::create_cylinder(glm::vec3 center1, Color color, glm::vec3 center2, float radius, float height) {
    return Object{CYLINDER, color, {center1.x, center1.y, center1.z, center2.x, center2.y, center2.z, radius, height}};
}

Objects::Object Objects::create_cuboid(glm::vec3 vertex, Color color, float length, float width, float height) {
    return Object{CUBOID, color, {vertex.x, vertex.y, vertex.z, length, width, height}};
}

Objects::Object Objects::create_tetrahedron(glm::vec3 vertex1, Color color, glm::vec3 vertex2, glm::vec3 vertex3, glm::vec3 vertex4) {
    return Object{TETRAHEDRON, color, {vertex1.x, vertex1.y, vertex1.z, vertex2.x, vertex2.y, vertex2.z, vertex3.x, vertex3.y, vertex3.z, vertex4.x, vertex4.y, vertex4.z}};
}