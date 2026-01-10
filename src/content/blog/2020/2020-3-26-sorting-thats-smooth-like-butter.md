---
layout: post
title: Sorting that's smooth like butter
---

Continuing on with the trend of exploring esoterically named sorting algorithms, I bring to you a blog post on....smoothsort! I'm gonna be real with you. I was sold on the name the moment I learned about this algorithm. 

Smoothsort is a sorting algorithm invented by Edsger Dijkstra. That name might sound familiar because Dijkstra is a notable computer scientists, known for his work on a variety of algorithms, including his famous self-named algorithm: Dijkstra's shortest path.

There isn't a lot of content out there about smoothsort. So hopefully, this blog post will help you (and let's be real, me) get an understanding of the algorithm. Before we learn about smoothsort, we have to learn about...

## Heapsort

Heapsort is a sorting algorithm that works on a special data structure known as a heap, particularly a binary heap. A binary heap is a is a tree structure that meets the following constraints:

- Each node in the tree must have two children.
- The value of each node is greater than or equal to the value of its children.

Here is an example of a binary heap that meets these constraints.

![Photo of binary heap](https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Max-Heap.svg/2560px-Max-Heap.svg.png)

So, heapsort starts by generating a binary heap for some input array. To build the sorted array, heapsort picks the top-most node in the heap and adds it to the beginning of a sorted array. Then, the heap is rebalanced and another value is selected from the top. And so on, until eventually heapsort has run through all the elements in the list.

So most of the grunt work in heapsort is actually happening in the heap, specifically when it comes to building and rebalancing the heap as we extract values out of it.

### The Leonardo Heap

Smoothsort is similar to heap sort with one key distinction. Instead of using a binary heap, smooth sort uses a Leonardo heap.

Before we dive into Leonardo heaps, we have to talk about Leonardo numbers. It feels like there's a lot of "before we...we have to..." in this blog post, but that's because smoothsort is quite a layer implementation.

Leonardo numbers are numbers that satisfy the following sequence.

- L(0) = 1
- L(1) = 1
- L(n) = L(n-1) + L(n-2) + 1

With this result in mind, the first few Leonardo numbers are: 1, 1, 3, 5, 9, 15, 25, 41, etc.

Leonardo heaps are built from one or more binary trees. Where does the Leonardo number come in? Well, each of the binary trees in the Leonardo heap must have a number of nodes that is a Leonardo number. For example, here is a Leonardo heap that consists of three binary trees, one with 9 nodes, another with 3, and a third with 1.

![Image of Leonardo Heap courtesy of keithschwarz.com](https://www.keithschwarz.com/smoothsort/images/leonardo-heap.png)

As you can see from this image, the root node in each tree is the largest value.

When adding and removing values from a Leonardo heap, we have to maintain the properties of the heap: specifically that it has to consist of a Leonardo-numbered set of binary trees.

As we remove values from the heap, the root node will shift to be the next largest value in the heap. So if we wanted to get a list sorted in descending order, we would remove values from the heap until all values had been removed.



### Why Leonardo heaps?

The first thought I had when researching this algorithm is: why Leonardo heaps in particular? In some scenarios, Leonardo heaps can perform better than binary heaps for insertion and deletion. 

## The implementation

With all this mind, let's take a stab at implementing smoothsort for ourselves. We're going to cheat a little bit in this blog post and assume that we already have an implementation of a Lenardo heap. That has the following interface.



```python
class LeonardoHeap():
    def __init__(self, input_array):
        self.input_array = input_array
        self.heap = self.create_heap(input_array)
    
    """
    Returns the rightmost root node in the Leonardo heap
    which matches with the largest value.
    """
    def pop(self):
        return largest_value 
```

Side note: It might be worthwhile to do a blog post on this structure in and off-itself.


```python
def smoothsort(input_array):
    length = len(input_array)
    if length <= 1:
        return input_arary
    return sort_with_heap(input_array)
```

The `sort_with_heap` function will take the input array, populate the values of the array onto a Lenardo heap, then pop values out of the heap to get an ordered list of values. 


```python
def sort_with_heap(input_array):
    heap = LeonardoHeap(input_array)
    length = len(input_array)
    result = []
    for x in range(length):
        result.append(heap.pop())
    return result
```

So that's that on that. Hopefully, you found this blog post a smooth read. Heh. Pun intended...

Alright, I'll see myself out. Thanks for reading folks!
