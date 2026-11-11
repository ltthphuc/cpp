#pragma once
/* Tự động đưa vào mọi chương trình: giúp mã viết cho Windows/GCC (system("pause"), __gcd...) chạy được trên trình duyệt. */
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
/* xuất theo từng dòng: printf/puts hiện lên ngay khi xuống dòng */
__attribute__((constructor)) static void __lab_init(void) { setvbuf(stdout, NULL, _IOLBF, 4096); }
static inline int __lab_system(const char* c) {
  if (!c) return 0;
  if (c[0] == 'p' && c[1] == 'a' && c[2] == 'u') {          /* system("pause") */
    fputs("Nhan Enter de tiep tuc . . .", stdout); fflush(stdout);
    int ch; while ((ch = getchar()) != EOF && ch != '\n') {}
  } else if (c[0] == 'c' && c[1] == 'l' && c[2] == 's') {    /* system("cls") */
    fputs("\n", stdout);
  }
  return 0;
}
#define system __lab_system
static inline int __gcd_compat(int a, int b) { while (b) { int t = a % b; a = b; b = t; } return a < 0 ? -a : a; }
static inline long __gcd_compat(long a, long b) { while (b) { long t = a % b; a = b; b = t; } return a < 0 ? -a : a; }
static inline long long __gcd_compat(long long a, long long b) { while (b) { long long t = a % b; a = b; b = t; } return a < 0 ? -a : a; }
static inline unsigned __gcd_compat(unsigned a, unsigned b) { while (b) { unsigned t = a % b; a = b; b = t; } return a; }
static inline unsigned long long __gcd_compat(unsigned long long a, unsigned long long b) { while (b) { unsigned long long t = a % b; a = b; b = t; } return a; }
#define __gcd __gcd_compat
