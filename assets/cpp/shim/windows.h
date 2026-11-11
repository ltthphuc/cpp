#pragma once
#include <unistd.h>
#include <stdlib.h>
inline void Sleep(unsigned long ms) { usleep(ms * 1000); }
