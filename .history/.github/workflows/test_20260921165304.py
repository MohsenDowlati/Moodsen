def tri_numbers(n):

    triplets = []

    for a in range(1,n//3+1):
        for b in range(a,(n-a)//2+1):
            c = n-a-b

        if a+b > c :
            triplets.append((a,b,c))
    return triplets

n = 15

res = tri_numbers(n)

for t in res:
    print(t)