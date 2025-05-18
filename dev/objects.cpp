#include <glm/glm.hpp>
#include "objects.h"


std::vector<float> Objects::Object::packObjectToTextureData() {
    std::vector<float> textureData(32);
    textureData[0] = static_cast<float>(type); // type
    textureData[1] = color.r; // R
    textureData[2] = color.g; // G
    textureData[3] = color.b; // B
    textureData[4] = color.a; // A
    for (int i = 0; i < 12; ++i) {
        textureData[5 + i] = pos_args[i];
    }
    return textureData;
}

Objects::Object Objects::create_sphere(Color color, glm::vec3 center, float radius) {
    return Object{SPHERE, color, {center.x, center.y, center.z, radius}};
}

Objects::Object Objects::create_cone(Color color, glm::vec3 center, glm::vec3 vertex, float radius) {
    return Object{CONE, color, {center.x, center.y, center.z, vertex.x, vertex.y, vertex.z, radius}};
}

Objects::Object Objects::create_cylinder(Color color, glm::vec3 center1, glm::vec3 center2, float radius) {
    return Object{CYLINDER, color, {center1.x, center1.y, center1.z, center2.x, center2.y, center2.z, radius}};
}

Objects::Object Objects::create_cuboid(Color color, glm::vec3 center, float length, float width, float height, float alpha, float beta, float gamma) {
    return Object{CUBOID, color, {center.x, center.y, center.z, length, width, height, alpha, beta, gamma}};
}

Objects::Object Objects::create_tetrahedron(Color color, glm::vec3 vertex1, glm::vec3 vertex2, glm::vec3 vertex3, glm::vec3 vertex4) {
    return Object{TETRAHEDRON, color, {vertex1.x, vertex1.y, vertex1.z, vertex2.x, vertex2.y, vertex2.z, vertex3.x, vertex3.y, vertex3.z, vertex4.x, vertex4.y, vertex4.z}};
}
        
void Objects::Object::translate(const glm::vec3& d)
{
    switch(type){
    case SPHERE:
    case CUBOID:
        pos_args[0]+=d.x; pos_args[1]+=d.y; pos_args[2]+=d.z; break;
    case CONE:
    case CYLINDER:
        for(int i=0;i<6;++i) pos_args[i]+=d[i%3];
        break;
    case TETRAHEDRON:
        for(int i=0;i<12;i+=3){ pos_args[i]+=d.x; pos_args[i+1]+=d.y; pos_args[i+2]+=d.z; }
        break;
    }
}

void Objects::Object::scale(float s)
{
    switch(type){
    case SPHERE:
        pos_args[3]*=s;   
        break;
    case CUBOID:
        pos_args[3]*=s; pos_args[4]*=s; pos_args[5]*=s;
        break;
    case CONE:
        {
        glm::vec3 base(pos_args[0], pos_args[1], pos_args[2]); 
        glm::vec3 apex(pos_args[3], pos_args[4], pos_args[5]);
        float     r   = pos_args[6];

        apex = base + (apex - base) * s;

        r *= s;

        pos_args[3] = apex.x; pos_args[4] = apex.y; pos_args[5] = apex.z;
        pos_args[6] = r;
        break;
        }
    case CYLINDER:
        {          
        glm::vec3 A(pos_args[0], pos_args[1], pos_args[2]);
        glm::vec3 B(pos_args[3], pos_args[4], pos_args[5]);
        glm::vec3 v = (B - A) * s;    
        B = A + v;
        pos_args[3] = B.x; pos_args[4] = B.y; pos_args[5] = B.z;
        pos_args[6] *= s; 
        break; 
        }
    case TETRAHEDRON: 
        {                 
        glm::vec3 v0(pos_args[0], pos_args[1], pos_args[2]);
        glm::vec3 v1(pos_args[3], pos_args[4], pos_args[5]);
        glm::vec3 v2(pos_args[6], pos_args[7], pos_args[8]);
        glm::vec3 v3(pos_args[9], pos_args[10], pos_args[11]);
        glm::vec3 c = (v0 + v1 + v2) / 3.0f;

        auto recalc=[&](glm::vec3& v){
            v = c + (v - c)*s;
        };
        recalc(v0); recalc(v1); recalc(v2); recalc(v3);

        pos_args[0]=v0.x; pos_args[1]=v0.y; pos_args[2]=v0.z;
        pos_args[3]=v1.x; pos_args[4]=v1.y; pos_args[5]=v1.z;
        pos_args[6]=v2.x; pos_args[7]=v2.y; pos_args[8]=v2.z;
        pos_args[9]=v3.x; pos_args[10]=v3.y; pos_args[11]=v3.z;
        break; 
        }
    }
}