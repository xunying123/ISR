cmake_minimum_required(VERSION 3.21)
project(ISR)

set(CMAKE_CXX_STANDARD 14)

INCLUDE_DIRECTORIES(${PROJECT_SOURCE_DIR}/include)
INCLUDE_DIRECTORIES(${PROJECT_SOURCE_DIR}/dev)
link_directories(${PROJECT_SOURCE_DIR}/lib)
file(GLOB SOURCES dev/*.h dev/*.cpp src/*.h src/*.c src/*.cpp)
add_executable(OpenGL ${SOURCES})
target_link_libraries(OpenGL ${PROJECT_SOURCE_DIR}/glfw/cmake-build-debug/src/libglfw.so)


