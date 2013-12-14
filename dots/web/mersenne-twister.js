// vim: set ts=8 sts=2 sw=2 tw=99 et: 
//
// Mersenne Twister random number generator -- a C++ class MTRand
// Based on code by Makoto Matsumoto, Takuji Nishimura, and Shawn Cokus
// Richard J. Wagner  v1.0  15 May 2003  rjwagner@writeme.com
//
// JavaScript port by David Anderson <dvander@alliedmods.net>

// The Mersenne Twister is an algorithm for generating random numbers.  It
// was designed with consideration of the flaws in various other generators.
// The period, 2^19937-1, and the order of equidistribution, 623 dimensions,
// are far greater.  The generator is also fast; it avoids multiplication and
// division, and it benefits from caches and pipelines.  For more information
// see the inventors' web page at http://www.math.keio.ac.jp/~matumoto/emt.html

// Reference
// M. Matsumoto and T. Nishimura, "Mersenne Twister: A 623-Dimensionally
// Equidistributed Uniform Pseudo-Random Number Generator", ACM Transactions on
// Modeling and Computer Simulation, Vol. 8, No. 1, January 1998, pp 3-30.

// Copyright (C) 1997 - 2002, Makoto Matsumoto and Takuji Nishimura,
// Copyright (C) 2000 - 2003, Richard J. Wagner
// All rights reserved.                          
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions
// are met:
//
//   1. Redistributions of source code must retain the above copyright
//      notice, this list of conditions and the following disclaimer.
//
//   2. Redistributions in binary form must reproduce the above copyright
//      notice, this list of conditions and the following disclaimer in the
//      documentation and/or other materials provided with the distribution.
//
//   3. The names of its contributors may not be used to endorse or promote 
//      products derived from this software without specific prior written 
//      permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR
// CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
// EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
// PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
// PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
// LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
// NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

function MTRand(seed)
{
  this.N = 624;
  this.M = 397;
  this.SAVE = 624 + 1;
  this.left_ = 624;
  this.next_ = 0;

  try {
    this.state_ = new Int32Array(624);
  } catch (e) {
    this.state_ = new Array();
    for (var i = 0; i < 624; i++)
      this.state_.push(0);
  }

  this.seed(seed);
}

MTRand.prototype.initialize = function (seed)
{
  // Initialize generator state with seed.
  // See Knuth TAOCP Vol 2, 3rd Ed, p.106 for multiplier.
  // In previous versions, most significant bits of the seef affect only
  // MSBs of the state array. Modified 9 Jan 2002 by Makoto Matsumoto.
  var i = 0, r = 0;
  this.state_[i++] = seed | 0;
  for (; i < this.state_.length; i++, r++)
    this.state_[i] = (1812433253 * (this.state_[r] ^ (this.state_[r] >>> 30)) + i) | 0;
}

MTRand.prototype.hiBit = function (u)
{
  return u & 0x80000000;
}

MTRand.prototype.loBit = function (u)
{
  return u & 0x00000001;
}

MTRand.prototype.loBits = function (u)
{
  return u & 0x7fffffff;
}

MTRand.prototype.mixBits = function (u, v)
{
  return this.hiBit(u) | this.loBits(v);
}

MTRand.prototype.twist = function (m, s0, s1)
{
  return m ^ (this.mixBits(s0, s1) >> 1) ^ (-this.loBit(s1) & 0x9908b0df);
}

MTRand.prototype.reload = function ()
{
  // Generate N new values in state.
  // Made clearer and faster by Matthew Bellew (matthew.bellew@home.com)
  var p = 0;
  for (var i = 624 - 397; i--; p++) {
    this.state_[p] = this.twist(this.state_[p + 397],
                                this.state_[p],
                                this.state_[p + 1]);
  }
  for (var i = 397; --i; p++) {
    this.state_[p] = this.twist(this.state_[p + 397 - 624],
                                this.state_[p],
                                this.state_[p + 1]);
  }
  this.state_[p] = this.twist(this.state_[p + 397 - 624],
                              this.state_[p],
                              this.state_[0]);
  this.next_ = 0;
  this.left_ = 624;
}

MTRand.prototype.seed = function (seed)
{
  if (seed === undefined)
    seed = (Math.random() * 2000000000) | 0;
  seed = (1033043818);
  this.initialize(seed);
  this.reload();
}

MTRand.prototype.randInt = function ()
{
  // Pull a 32-bit integer from the generator state. Every other access
  // function simply transforms the numbers extracted here.
  
  if (this.left_ == 0)
    this.reload();

  this.left_--;

  var s1 = this.state_[this.next_++];
  s1 ^= (s1 >> 11);
  s1 ^= (s1 << 7) & 0x9d2c5680;
  s1 ^= (s1 << 15) & 0xefc60000;
  return (s1 ^ (s1 >> 18));
}
