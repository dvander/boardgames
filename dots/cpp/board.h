// vim: set ts=8 sts=2 sw=2 tw=99 et: 
#ifndef _include_dotsolver_board_h_
#define _include_dotsolver_board_h_

#include <assert.h>
#include <stddef.h>
#include <vector>

namespace dts {

enum Player
{
  Player_None = 0,
  Player_A = 2, // 010b
  Player_B = 3, // 011b
  Players_Total
};

static inline Player
Opponent(Player player)
{
  return (Player)(unsigned(player) ^ 1);
}

struct Point
{
  unsigned x;
  unsigned y;

  Point() : x(0), y(0)
  { }
  Point(unsigned x, unsigned y) : x(x), y(y)
  { }
};

struct Edge
{
  Player player;
  Point p1;
  Point p2;
};

enum TileType
{
  Tile_Dot,           // Point on the UI grid.
  Tile_HorizontalGap, // Horizontal gap between two dots.
  Tile_VerticalGap,   // Vertical gap between two dots.
  Tile_Space          // Space surrounded by four gaps.
};

class Board
{
 public:
  static Board *New(unsigned dot_rows, unsigned dot_cols);
  static Board *Copy(const Board *other);

  unsigned vertexOf(unsigned row, unsigned col) const {
    assert(row < rows_);
    assert(col < cols_);
    return row * cols_ + col;
  }
  bool vertexOf(unsigned row, unsigned col, unsigned *vertex) const {
    if (row >= rows_ || col >= cols_)
      return false;
    *vertex = vertexOf(row, col);
    return true;
  }
  unsigned vertexToRow(unsigned vertex) const {
    assert(vertex < rows_ * cols_);
    return vertex / cols_;
  }
  unsigned vertexToCol(unsigned vertex) const {
    assert(vertex < rows_ * cols_);
    return vertex % cols_;
  }
  Point vertexToPoint(unsigned vertex) const {
    unsigned row = vertexToRow(vertex);
    unsigned col = vertexToCol(vertex);
    return Point(row / 2, col / 2);
  }
  Player lineAt(unsigned vertex) const {
    assert(vertex < rows_ * cols_);
    assert(isPlayable(vertex));
    return (Player)grid_[vertex];
  }
  Player filledAt(unsigned vertex) const {
    assert(vertex < rows_ * cols_);
    assert(!isPlayable(vertex));
    return (Player)grid_[vertex];
  }
  bool isPlayable(unsigned vertex) const {
    // Every other vertex starting from 1 is playable.
    return !!(vertex & 1);
  }
  bool isEmpty(unsigned vertex) const {
    assert(isPlayable(vertex));
    return lineAt(vertex) == Player_None;
  }
  unsigned freeVertices() const {
    return empty_count_;
  }
  unsigned getFreeVertex(unsigned i) const {
    return empty_list_[i];
  }

  // For UI.
  bool isValidMove(unsigned vertex) const {
    return isPlayable(vertex) && isEmpty(vertex);
  }

  TileType tile(unsigned vertex) const {
    assert(vertex < rows_ * cols_);
    if (vertex & 1) {
      return vertexToRow(vertex) % 2
             ? Tile_VerticalGap
             : Tile_HorizontalGap;
    }
    if (vertexToRow(vertex) % 2 == 0)
      return Tile_Dot;
    return Tile_Space;
  }

  unsigned rows() const {
    return rows_;
  }
  unsigned cols() const {
    return cols_;
  }
  unsigned dot_rows() const {
    return (rows_ + 1) / 2;
  }
  unsigned dot_cols() const {
    return (cols_ + 1) / 2;
  }

  // Place a piece at the given coordinate.
  void playAt(unsigned vertex);

  // Helpers for coordinate system translation.
  bool edgeToVertex(const Point &p1, const Point &p2, unsigned *vertex) const;
  void vertexToEdge(unsigned vertex, Point *p1, Point *p2) const;

  // Return a sorted list of edges in visual dot-space.
  std::vector<Edge> edges() const;

  // Return a list of filled squares in visual dot-space. Rectangles are
  // returned as unit rects with the point in the upper-left corner. The
  // list is sorted.
  std::vector<Point> filled() const;

  bool game_over() const {
    assert(empty_count_ || !capturable_);
    return empty_count_ == 0;
  }
  Player player() const {
    return current_player_;
  }
  Player winner() const {
    // We return a winner even if the game isn't over, if the game's outcome
    // cannot possibly be changed. This is mostly for UCT which doesn't care
    // about point differentials, only win/loss.
    if (scores_[Player_A] > scores_[Player_B]) {
      if (scores_[Player_A] - scores_[Player_B] > capturable_)
        return Player_A;
    }
    if (scores_[Player_B] > scores_[Player_A]) {
      if (scores_[Player_B] - scores_[Player_A] > capturable_)
        return Player_B;
    }
    return Player_None;
  }
  Player estimate() const {
    if (score(Player_A) > score(Player_B))
      return Player_A;
    if (score(Player_A) < score(Player_B))
      return Player_B;
    return Player_None;
  }
  unsigned move_count() const {
    return total_moves_ - empty_count_;
  }
  unsigned score(Player player) const {
    assert(player == Player_A || player == Player_B);
    return scores_[player];
  }

 private:
  Board();

  void addAdjacent(unsigned vertex);

  // Edge checking and coordinate movement.
  bool onLeftEdge(unsigned vertex) const {
    return vertex % cols_ == 0;
  }
  unsigned left(unsigned vertex) const {
    assert(!onLeftEdge(vertex));
    return vertex - 1;
  }
  unsigned onRightEdge(unsigned vertex) const {
    return vertex % cols_ == cols_ - 1;
  }
  unsigned right(unsigned vertex) const {
    assert(!onRightEdge(vertex));
    return vertex + 1;
  }
  bool onTopEdge(unsigned vertex) const {
    return vertex < cols_;
  }
  unsigned up(unsigned vertex) const {
    return vertex - cols_;
  }
  bool onBottomEdge(unsigned vertex) const {
    return vertex >= ((rows_ - 1) * cols_);
  }
  unsigned down(unsigned vertex) const {
    return vertex + cols_;
  }

  // Some combined checks for +/- 2 out. Minimum grid coordinate system is 3x3,
  // which equates to a 5x5 board, so these checks will never under or overflow.
  bool canCheckLeft(unsigned vertex) const {
    return (vertex % cols_) > 1;
  }
  bool canCheckRight(unsigned vertex) const {
    return (vertex % cols_) < cols_ - 2;
  }
  bool canCheckAbove(unsigned vertex) const {
    return vertex > cols_ * 2;
  }
  bool canCheckBelow(unsigned vertex) const {
    return vertex >= ((rows_ - 2) * cols_);
  }

 private:
  unsigned rows_;
  unsigned cols_;

  // Contains the Player that owns a point on the grid.
  unsigned *grid_;
  unsigned empty_count_;

  // For playable vertices, contains a mapping back to the empty list if
  // unplayed, otherwise contains non-zero.
  // For unplayable vertices, contains the number of adjacent vertices that
  // have been filled in.
  unsigned *empty_map_;

  // Contains a list of free vertices
  unsigned *empty_list_;
  Player current_player_;
  unsigned scores_[Players_Total];
  unsigned capturable_;
  unsigned total_moves_;
};

} // namespace dts

#endif // _include_dotsolver_board_h_
