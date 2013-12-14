// vim: set ts=8 sts=2 sw=2 tw=99 et: 
#include "board.h"
#include <new>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

using namespace dts;

static inline size_t
SizeFor(unsigned rows, unsigned cols)
{
  size_t bytes =
    sizeof(Board) +
    rows * cols * sizeof(unsigned) + // grid_
    rows * cols * sizeof(unsigned) + // empty_map_
    rows * cols * sizeof(unsigned);  // empty_list_
  return bytes;
}

Board::Board()
{
  grid_ = reinterpret_cast<unsigned *>(this + 1);
  empty_map_ = grid_ + (rows_ * cols_);
  empty_list_ = empty_map_ + (rows_ * cols_);
}

Board *
Board::New(unsigned dot_rows, unsigned dot_cols)
{
  unsigned rows = dot_rows * 2 - 1;
  unsigned cols = dot_cols * 2 - 1;

  size_t bytes = SizeFor(rows, cols);
  Board *board = (Board *)calloc(1, bytes);
  board->rows_ = rows;
  board->cols_ = cols;
  board->total_moves_ = (dot_rows * (dot_cols - 1)) +
                        (dot_cols * (dot_rows - 1));
  new (board) Board();

  // Visually, grids look like this:
  //  .-.-.-. 
  //  ! ! ! .
  //  . . . .
  //  . . . .
  //
  // We transform the grid to a checkerboard:
  // _______________
  // |_|X|_|X|_|X|_|
  // |X|_|X|_|X|_|X|
  // |_|_|_|_|_|_|_|
  // |_|_|_|_|_|_|_|
  // |_|_|_|_|_|_|_|
  // |_|_|_|_|_|_|_|
  // |_|_|_|_|_|_|_|
  //
  // Filled, with O marking capturable points:
  // _______________
  // |_|X|_|X|_|X|_|
  // |X|O|X|O|X|O|X|
  // |_|X|_|X|_|X|_|
  // |X|O|X|O|X|O|X|
  // |_|X|_|X|_|X|_|
  // |X|O|X|O|X|O|X|
  // |_|X|_|X|_|X|_|
  //
  // A grid with N dot-rows and M dot-cols becomes an (N-1) * (M-1)
  // checkerboard, and space is surrounded by diamond patterns instead of
  // lines. This makes bookkeeping a lot easier.
  
  // Build the empty vertex list, which is used for performing fast random
  // playouts. Note we start at index 1, since the corners are not playable.
  board->empty_count_ = 0;
  for (unsigned i = 1; i < rows * cols; i += 2) {
    board->empty_map_[i] = board->empty_count_;
    board->empty_list_[board->empty_count_] = i;
    board->empty_count_++;
  }

  // The maximum number of fillable points is (N-1) * (M-1) where N and M
  // are the original dot sizes.
  board->capturable_ = (dot_rows - 1) * (dot_cols - 1);

  board->current_player_ = Player_A;
  return board;
}

Board *
Board::Copy(const Board *other)
{
  size_t bytes = SizeFor(other->rows_, other->cols_);
  Board *board = (Board *)malloc(bytes);
  memcpy(board, other, bytes);
  new (board) Board();
  return board;
}

void
Board::vertexToEdge(unsigned vertex, Point *p1, Point *p2) const
{
  unsigned row = vertexToRow(vertex);
  unsigned col = vertexToCol(vertex);

  *p1 = Point(col / 2, row / 2);

  // Even rows are horizontal lines, odd are vertical.
  if (row % 2 == 0)
    *p2 = Point(p1->x + 1, p1->y);
  else
    *p2 = Point(p1->x, p1->y + 1);
}

bool
Board::edgeToVertex(const Point &p1, const Point &p2, unsigned *vertex) const
{
  if (p1.x == p2.x && p1.y + 1 == p2.y) {
    // Vertical line, pick the odd row.
    return vertexOf(p1.y * 2 + 1, p1.x * 2, vertex);
  }
  if (p1.x + 1== p2.x && p1.y == p2.y) {
    // Horizontal line, pick the even row.
    return vertexOf(p1.y * 2, p1.x * 2 + 1, vertex);
  }
  return false;
}

std::vector<Edge>
Board::edges() const
{
  std::vector<Edge> edges;
  
  for (unsigned i = 1; i < rows_ * cols_; i += 2) {
    Player player = lineAt(i);
    if (player == Player_None)
      continue;

    Edge e;
    e.player = player;
    vertexToEdge(i, &e.p1, &e.p2);
    edges.push_back(e);
  }

  return edges;
}

std::vector<Point>
Board::filled() const
{
  std::vector<Point> rects;

  // Not all grid spaces can be surrounded. We just loop through them all
  // anyway though.
  for (unsigned i = 0; i < rows_ * cols_; i += 2) {
    Player player = filledAt(i);
    if (player == Player_None)
      continue;

    rects.push_back(vertexToPoint(i));
  }

  return rects;
}

void
Board::addAdjacent(unsigned vertex)
{
  assert(!isPlayable(vertex));
  assert(empty_map_[vertex] < 4);

  // Edges do not contribute to surrounding a square, which makes things a
  // little easier than say Go where edges decrease liberties.
  empty_map_[vertex] += 1;
  if (empty_map_[vertex] == 4) {
    grid_[vertex] = current_player_;
    scores_[current_player_]++;

    assert(capturable_ > 0);
    capturable_--;
  }
}

void
Board::playAt(unsigned vertex)
{
  assert(isValidMove(vertex));

  // Remove this vertex from the free list.
  unsigned free_index = empty_map_[vertex];
  assert(empty_list_[free_index] == vertex);

  empty_count_--;
  if (free_index != empty_count_) {
    // We took the last slot off the end, move it into the old slot.
    unsigned swap_vertex = empty_list_[empty_count_];
    empty_list_[free_index] = swap_vertex;
    empty_map_[swap_vertex] = free_index;
  }

  grid_[vertex] = current_player_;
  unsigned old_score = scores_[current_player_];

  // Squares on even rows are not counted, they're dead space. If we're on an
  // odd row, we only have to check left/right, and on even rows, up/down.
  if (vertexToRow(vertex) & 1) {
    if (!onLeftEdge(vertex))
      addAdjacent(left(vertex));
    if (!onRightEdge(vertex))
      addAdjacent(right(vertex));
  } else {
    if (!onTopEdge(vertex))
      addAdjacent(up(vertex));
    if (!onBottomEdge(vertex))
      addAdjacent(down(vertex));
  }

  // If you capture a square, you get another turn. Otherwise, switch players.
  if (old_score == scores_[current_player_]) {
    current_player_ = Opponent(current_player_);
  }

  //printf("%d\n", vertex);
}

